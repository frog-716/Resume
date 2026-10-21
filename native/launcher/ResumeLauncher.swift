import AppKit
import CoreGraphics
import Darwin
import Foundation

private struct BundleInputs {
    let resources: URL
    let server: URL
    let domainDirectory: URL
    let frontend: URL

    init(executableURL: URL) {
        let bundle = Bundle.main
        let resources = bundle.resourceURL
            ?? executableURL
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("Resources", isDirectory: true)

        self.resources = resources
        self.server = resources.appendingPathComponent("server/index.mjs")
        self.domainDirectory = resources.appendingPathComponent("src/domain", isDirectory: true)
        self.frontend = resources.appendingPathComponent("dist/index.html")
    }

    var missingInputs: [String] {
        var missing: [String] = []
        if !FileManager.default.isReadableFile(atPath: server.path) {
            missing.append("Resources/server/index.mjs")
        }
        var isDirectory: ObjCBool = false
        if !FileManager.default.fileExists(atPath: domainDirectory.path, isDirectory: &isDirectory) || !isDirectory.boolValue {
            missing.append("Resources/src/domain/")
        }
        if !FileManager.default.isReadableFile(atPath: frontend.path) {
            missing.append("Resources/dist/index.html")
        }
        return missing
    }
}

@main
@MainActor
private struct LauncherMain {
    static func main() {
        if CommandLine.arguments.contains("--check-resources") {
            checkResources()
            return
        }

        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }

    private static func checkResources() {
        let inputs = BundleInputs(executableURL: URL(fileURLWithPath: CommandLine.arguments[0]))
        if inputs.missingInputs.isEmpty {
            print("READY: server/index.mjs and dist/index.html are present")
            exit(EXIT_SUCCESS)
        }

        for input in inputs.missingInputs {
            fputs("MISSING: \(input)\n", stderr)
        }
        exit(2)
    }
}

@MainActor
private final class AppDelegate: NSObject, NSApplicationDelegate {
    private let stdoutParser = StdoutParser()
    private let diagnosticsBuffer = DiagnosticBuffer()

    private var serviceProcess: Process?
    private var chromeProcess: Process?
    private var serviceStdout: Pipe?
    private var serviceStderr: Pipe?
    private var readinessTimer: Timer?
    private var chromeWindowTimer: Timer?
    private var chromeWindowSeen = false
    private var chromeLaunchedAt: Date?
    private var profileDirectory: URL?
    private var shuttingDown = false
    private var terminateReplyPending = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenu()

        let inputs = BundleInputs(executableURL: Bundle.main.executableURL ?? URL(fileURLWithPath: CommandLine.arguments[0]))
        guard inputs.missingInputs.isEmpty else {
            failAndQuit("开发版尚未具备启动所需文件：\n\n\(inputs.missingInputs.joined(separator: "\n"))\n\n请先补齐服务和构建好的前端，再重新运行构建脚本。")
            return
        }

        do {
            try startService(inputs: inputs)
        } catch {
            failAndQuit("Resume 启动失败：\n\n\(error.localizedDescription)")
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard serviceProcess?.isRunning == true || chromeProcess?.isRunning == true else {
            return .terminateNow
        }
        beginShutdown()
        terminateReplyPending = true
        return .terminateLater
    }

    private func installMenu() {
        let root = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Resume")
        appMenu.addItem(NSMenuItem(title: "退出 Resume", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        root.addItem(appItem)
        root.setSubmenu(appMenu, for: appItem)
        NSApp.mainMenu = root
    }

    private func startService(inputs: BundleInputs) throws {
        let fileManager = FileManager.default
        let supportDirectory = fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Resume", isDirectory: true)
        try fileManager.createDirectory(at: supportDirectory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])

        let candidates = nodeCandidates(resources: inputs.resources)
        guard let node = candidates.first(where: canRunNode) else {
            throw LauncherError("Resources/Runtime/node 或本机开发版 Node.js 无法运行。")
        }

        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()
        process.executableURL = node
        process.arguments = [inputs.server.path]
        process.currentDirectoryURL = inputs.resources
        var environment = ProcessInfo.processInfo.environment
        environment["RESUME_DATA_DIR"] = supportDirectory.path
        environment["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
        process.environment = environment
        process.standardOutput = stdout
        process.standardError = stderr
        process.terminationHandler = { [weak self] process in
            Task { @MainActor [weak self] in
                self?.serviceTerminated(process)
            }
        }

        serviceProcess = process
        serviceStdout = stdout
        serviceStderr = stderr
        installOutputReaders(stdout: stdout, stderr: stderr)
        try process.run()

        readinessTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.failAndQuit("服务在 60 秒内没有输出 RESUME_READY http://127.0.0.1:<端口>。")
            }
        }
    }

    private func nodeCandidates(resources: URL) -> [URL] {
        var candidates = [resources.appendingPathComponent("Runtime/node")]
        candidates.append(URL(fileURLWithPath: "/opt/homebrew/bin/node"))
        candidates.append(URL(fileURLWithPath: "/usr/local/bin/node"))
        candidates.append(URL(fileURLWithPath: "/usr/bin/node"))
        var seen = Set<String>()
        return candidates.filter { candidate in
            seen.insert(candidate.path).inserted && FileManager.default.isExecutableFile(atPath: candidate.path)
        }
    }

    private func canRunNode(_ url: URL) -> Bool {
        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()
        process.executableURL = url
        process.arguments = ["--version"]
        process.standardOutput = stdout
        process.standardError = stderr
        do {
            try process.run()
            process.waitUntilExit()
            _ = stdout.fileHandleForReading.readDataToEndOfFile()
            _ = stderr.fileHandleForReading.readDataToEndOfFile()
            return process.terminationStatus == 0
        } catch {
            return false
        }
    }

    private func installOutputReaders(stdout: Pipe, stderr: Pipe) {
        let parser = stdoutParser
        let diagnostics = diagnosticsBuffer
        stdout.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                handle.readabilityHandler = nil
                return
            }
            let lines = parser.append(data)
            for line in lines where line.hasPrefix("RESUME_READY") {
                Task { @MainActor [weak self] in
                    self?.handleReadyLine(line)
                }
            }
        }

        stderr.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                handle.readabilityHandler = nil
                return
            }
            diagnostics.append(data)
        }
    }

    private func handleReadyLine(_ line: String) {
        guard !shuttingDown, chromeProcess == nil else { return }
        guard line.hasPrefix("RESUME_READY "),
              let url = URL(string: String(line.dropFirst("RESUME_READY ".count))),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme == "http",
              components.host == "127.0.0.1",
              let port = components.port,
              (1...65535).contains(port),
              components.user == nil,
              components.password == nil else {
            failAndQuit("服务输出的就绪地址不符合本机回环地址要求：\n\n\(line)")
            return
        }

        readinessTimer?.invalidate()
        readinessTimer = nil
        do {
            guard let service = serviceProcess else {
                throw LauncherError("未找到本次启动的服务进程。")
            }
            try verifyLoopbackListener(pid: service.processIdentifier, port: port)
            try launchChrome(url: url)
        } catch {
            failAndQuit("服务已报告就绪，但没有通过本机回环监听检查，或 Chrome 无法打开：\n\n\(error.localizedDescription)")
        }
    }

    private func verifyLoopbackListener(pid: Int32, port: Int) throws {
        let lsof = URL(fileURLWithPath: "/usr/sbin/lsof")
        guard FileManager.default.isExecutableFile(atPath: lsof.path) else {
            throw LauncherError("系统缺少 lsof，无法确认服务只监听 127.0.0.1。")
        }

        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()
        process.executableURL = lsof
        process.arguments = ["-nP", "-a", "-p", String(pid), "-iTCP:\(port)", "-sTCP:LISTEN"]
        process.standardOutput = stdout
        process.standardError = stderr
        try process.run()
        process.waitUntilExit()
        let output = String(decoding: stdout.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        _ = stderr.fileHandleForReading.readDataToEndOfFile()

        let endpointLines = output
            .components(separatedBy: .newlines)
            .filter { $0.contains(" TCP ") }
        let expectedEndpoint = try NSRegularExpression(pattern: "TCP\\s+127\\.0\\.0\\.1:\(port)\\s+\\(LISTEN\\)")
        let hasOnlyLoopbackListener = endpointLines.count == 1 && expectedEndpoint.firstMatch(
            in: endpointLines[0],
            range: NSRange(endpointLines[0].startIndex..., in: endpointLines[0])
        ) != nil
        guard process.terminationStatus == 0, hasOnlyLoopbackListener else {
            throw LauncherError("要求服务仅监听 127.0.0.1:\(port)；当前监听地址为：\(endpointLines.joined(separator: "；").isEmpty ? "未找到监听端口" : endpointLines.joined(separator: "；"))")
        }
    }

    private func launchChrome(url: URL) throws {
        let chromeURL = chromeExecutable()
        guard let chromeURL else {
            throw LauncherError("找不到 Google Chrome。优先检查 /Applications/Google Chrome.app。")
        }

        let supportDirectory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Application Support/Resume", isDirectory: true)
        let profile = supportDirectory
            .appendingPathComponent("ChromeProfiles", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: profile, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        profileDirectory = profile

        let process = Process()
        let stdout = Pipe()
        let stderr = Pipe()
        process.executableURL = chromeURL
        process.arguments = [
            "--app=\(url.absoluteString)",
            "--user-data-dir=\(profile.path)",
            "--no-first-run",
            "--no-default-browser-check",
        ]
        process.standardOutput = stdout
        process.standardError = stderr
        process.terminationHandler = { [weak self] process in
            Task { @MainActor [weak self] in
                self?.chromeTerminated(process)
            }
        }
        drain(stdout.fileHandleForReading)
        drain(stderr.fileHandleForReading)
        try process.run()
        chromeProcess = process
        chromeLaunchedAt = Date()
        chromeWindowTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.checkChromeWindow()
            }
        }
    }

    private func chromeExecutable() -> URL? {
        let preferred = URL(fileURLWithPath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        if FileManager.default.isExecutableFile(atPath: preferred.path) {
            return preferred
        }

        let local = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
        if FileManager.default.isExecutableFile(atPath: local.path) {
            return local
        }

        if let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome") {
            let executable = appURL.appendingPathComponent("Contents/MacOS/Google Chrome")
            if FileManager.default.isExecutableFile(atPath: executable.path) {
                return executable
            }
        }
        return nil
    }

    private func drain(_ handle: FileHandle) {
        handle.readabilityHandler = { fileHandle in
            if fileHandle.availableData.isEmpty {
                fileHandle.readabilityHandler = nil
            }
        }
    }

    private func checkChromeWindow() {
        guard let process = chromeProcess, let launchedAt = chromeLaunchedAt else { return }
        guard process.isRunning else {
            beginShutdown()
            return
        }

        let options: CGWindowListOption = [.optionAll, .excludeDesktopElements]
        let windows = (CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]]) ?? []
        let hasChromeWindow = windows.contains { info in
            guard let owner = info[kCGWindowOwnerPID as String] as? NSNumber,
                  owner.int32Value == process.processIdentifier else { return false }
            if let layer = info[kCGWindowLayer as String] as? NSNumber, layer.intValue != 0 {
                return false
            }
            return true
        }

        if hasChromeWindow {
            chromeWindowSeen = true
            return
        }

        let elapsed = Date().timeIntervalSince(launchedAt)
        if chromeWindowSeen && elapsed > 3 {
            beginShutdown()
        } else if !chromeWindowSeen && elapsed > 30 {
            failAndQuit("Chrome 已启动，但没有出现应用窗口。")
        }
    }

    private func serviceTerminated(_ process: Process) {
        guard process === serviceProcess, !shuttingDown else { return }
        readinessTimer?.invalidate()
        readinessTimer = nil
        let detail = diagnosticsBuffer.snapshot().trimmingCharacters(in: .whitespacesAndNewlines)
        let suffix = detail.isEmpty ? "" : "\n\n服务错误输出：\n\(String(detail.suffix(2_000)))"
        failAndQuit("Resume 本机服务已退出，退出码 \(process.terminationStatus)。\(suffix)")
    }

    private func chromeTerminated(_ process: Process) {
        guard process === chromeProcess, !shuttingDown else { return }
        beginShutdown()
    }

    private func failAndQuit(_ message: String) {
        guard !shuttingDown else { return }
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Resume 启动失败"
        alert.informativeText = message
        alert.addButton(withTitle: "好")
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
        beginShutdown()
    }

    private func beginShutdown() {
        guard !shuttingDown else { return }
        shuttingDown = true
        readinessTimer?.invalidate()
        readinessTimer = nil
        chromeWindowTimer?.invalidate()
        chromeWindowTimer = nil

        if let chrome = chromeProcess, chrome.isRunning {
            chrome.terminate()
        }
        if let service = serviceProcess, service.isRunning {
            service.terminate()
        }

        guard chromeProcess?.isRunning == true || serviceProcess?.isRunning == true else {
            finishShutdown()
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self else { return }
            self.forceStopIfNeeded(self.chromeProcess)
            self.forceStopIfNeeded(self.serviceProcess)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.finishShutdown()
            }
        }
    }

    private func forceStopIfNeeded(_ process: Process?) {
        guard let process, process.isRunning else { return }
        _ = kill(process.processIdentifier, SIGKILL)
    }

    private func finishShutdown() {
        if let profileDirectory, chromeProcess?.isRunning != true {
            try? FileManager.default.removeItem(at: profileDirectory)
        }
        profileDirectory = nil
        if terminateReplyPending {
            terminateReplyPending = false
            NSApp.reply(toApplicationShouldTerminate: true)
        } else {
            NSApp.terminate(nil)
        }
    }
}

private struct LauncherError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

private final class StdoutParser: @unchecked Sendable {
    private let lock = NSLock()
    private var remainder = ""

    func append(_ data: Data) -> [String] {
        lock.lock()
        defer { lock.unlock() }

        remainder.append(String(decoding: data, as: UTF8.self))
        var lines: [String] = []
        while let newline = remainder.firstIndex(of: "\n") {
            let line = String(remainder[..<newline]).trimmingCharacters(in: .whitespacesAndNewlines)
            remainder = String(remainder[remainder.index(after: newline)...])
            lines.append(line)
        }
        if remainder.count > 12_000 {
            remainder = String(remainder.suffix(12_000))
        }
        return lines
    }
}

private final class DiagnosticBuffer: @unchecked Sendable {
    private let lock = NSLock()
    private var content = ""

    func append(_ data: Data) {
        lock.lock()
        defer { lock.unlock() }
        content.append(String(decoding: data, as: UTF8.self))
        if content.count > 12_000 {
            content = String(content.suffix(12_000))
        }
    }

    func snapshot() -> String {
        lock.lock()
        defer { lock.unlock() }
        return content
    }
}

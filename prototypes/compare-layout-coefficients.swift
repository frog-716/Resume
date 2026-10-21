import CoreText
import Foundation

// Measures the current demo's Chinese/English text with macOS CoreText fonts,
// then estimates vertical A4 fit for three linked-spacing profiles.
// It is a font-metric simulation, not a browser/PDF rendering test.

struct ExperienceProject {
    let name: String
    let role: String
    let date: String
    let bullets: [String]
}

struct Profile {
    let name: String
    let line: CGFloat
    let head: CGFloat
    let bullet: CGFloat
    let section: CGFloat
}

struct Scenario {
    let workCount: Int
    let projectCount: Int
    let extraBullets: Int
}

final class TextMeasurer {
    private var lineCache: [String: Int] = [:]
    private var fontCache: [String: CTFont] = [:]

    func lineCount(_ text: String, size: CGFloat, width: CGFloat) -> Int {
        let sizeKey = Int((size * 100).rounded())
        let widthKey = Int((width * 100).rounded())
        let key = "\(sizeKey)|\(widthKey)|\(text)"
        if let cached = lineCache[key] { return cached }

        let ns = text as NSString
        guard ns.length > 0 else { return 1 }
        let attributed = NSMutableAttributedString(string: text)
        var previousKind = "en"

        for index in 0..<ns.length {
            let code = ns.character(at: index)
            let previousCode = index > 0 ? ns.character(at: index - 1) : 0
            let nextCode = index + 1 < ns.length ? ns.character(at: index + 1) : 0
            let isDigit = code >= 48 && code <= 57
            let isLatin = (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
            let neighborIsDigit = (previousCode >= 48 && previousCode <= 57)
                || (nextCode >= 48 && nextCode <= 57)
            let kind: String
            if isDigit || (code < 128 && neighborIsDigit) {
                kind = "num"
            } else if isLatin {
                kind = "en"
            } else if code >= 128 {
                kind = "zh"
            } else {
                kind = previousKind
            }
            previousKind = kind

            let fontName = kind == "zh" ? "PingFang SC" : "Times New Roman"
            let fontKey = "\(fontName)|\(sizeKey)"
            let font = fontCache[fontKey] ?? CTFontCreateWithName(fontName as CFString, size, nil)
            fontCache[fontKey] = font
            attributed.addAttribute(
                NSAttributedString.Key(kCTFontAttributeName as String),
                value: font,
                range: NSRange(location: index, length: 1)
            )
        }

        let typesetter = CTTypesetterCreateWithAttributedString(attributed as CFAttributedString)
        var cursor = 0
        var lines = 0
        while cursor < ns.length {
            let count = CTTypesetterSuggestLineBreak(typesetter, cursor, width)
            if count <= 0 { lines += 1; break }
            cursor += count
            lines += 1
        }
        let result = max(lines, 1)
        lineCache[key] = result
        return result
    }
}

func quotedStrings(_ text: String) -> [String] {
    guard let regex = try? NSRegularExpression(pattern: "'([^']*)'") else { return [] }
    let ns = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).compactMap {
        guard $0.numberOfRanges > 1 else { return nil }
        return ns.substring(with: $0.range(at: 1))
    }
}

func capture(_ pattern: String, in text: String, group: Int = 1) -> [String] {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else { return [] }
    let ns = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: ns.length)).compactMap {
        guard $0.numberOfRanges > group else { return nil }
        return ns.substring(with: $0.range(at: group))
    }
}

func sourceText(path: String) throws -> (skills: [String], work: [String], projects: [ExperienceProject], education: [String]) {
    let html = try String(contentsOfFile: path, encoding: .utf8)
    func array(_ name: String) -> [String] {
        guard let body = capture("const \(name)=\\[(.*?)\\];", in: html).first else { return [] }
        return quotedStrings(body)
    }

    let projectBlock = capture("const projects=\\[(.*?)\\];\\nconst extraText", in: html).first ?? ""
    let projectMatches = capture("\\{name:'([^']*)',role:'([^']*)',date:'([^']*)',items:\\[(.*?)\\]\\}", in: projectBlock, group: 0)
    let projects = projectMatches.compactMap { item -> ExperienceProject? in
        guard let fields = try? NSRegularExpression(pattern: "name:'([^']*)',role:'([^']*)',date:'([^']*)',items:\\[(.*?)\\]", options: [.dotMatchesLineSeparators]) else { return nil }
        let ns = item as NSString
        guard let match = fields.firstMatch(in: item, range: NSRange(location: 0, length: ns.length)), match.numberOfRanges == 5 else { return nil }
        return ExperienceProject(
            name: ns.substring(with: match.range(at: 1)),
            role: ns.substring(with: match.range(at: 2)),
            date: ns.substring(with: match.range(at: 3)),
            bullets: quotedStrings(ns.substring(with: match.range(at: 4)))
        )
    }

    return (
        skills: array("skillText"),
        work: array("workText"),
        projects: projects,
        education: [
            "学习经历：课程覆盖数据分析、软件基础、系统设计与项目实践，结合课程任务完成数据整理和结果展示。",
            "项目实践：在团队项目中承担资料整理、原型搭建与结果验证，记录过程问题，形成结构清晰的说明文档。",
        ]
    )
}

func split(_ values: [String], into count: Int) -> [[String]] {
    guard count > 0 else { return [] }
    return (0..<count).map { group in
        let start = group * values.count / count
        let end = (group + 1) * values.count / count
        return Array(values[start..<end])
    }
}

let profiles = [
    Profile(name: "紧凑", line: 1.30, head: 1.20, bullet: 0.11, section: 0.60),
    Profile(name: "适中偏紧", line: 1.35, head: 1.28, bullet: 1.35 / 9.5, section: 7 / 9.5),
    Profile(name: "中间", line: 1.375, head: 1.30, bullet: 1.5 / 9.5, section: 7.5 / 9.5),
    Profile(name: "偏舒展", line: 1.40, head: 1.32, bullet: 1.65 / 9.5, section: 8 / 9.5),
    Profile(name: "舒展", line: 1.45, head: 1.35, bullet: 0.20, section: 0.90),
]

let workHeaders = [
    ("远景科技 · 虚构公司", "数据与运营助理", "2024.06 — 2025.08"),
    ("星河科技 · 运营团队", "产品运营专员", "2022.01 — 2024.05"),
    ("绿洲科技 · 数据中心", "业务分析助理", "2020.06 — 2021.12"),
]
let educationHeader = ("示例大学", "信息工程 · 虚构专业", "2020 — 2024")
let a4TextWidth = 192 * 72 / 25.4
let bulletTextWidth = a4TextWidth - 17 * 72 / 96
let headerInnerWidth = a4TextWidth - 10 * 72 / 96 - 2 * 12 * 72 / 96
let threeColumnWidth = headerInnerWidth / 3
let educationWidths: [CGFloat] = [headerInnerWidth / 5, headerInnerWidth * 3 / 5, headerInnerWidth / 5]
let availableHeight = 279 * 72 / 25.4
let sectionPillHeight: CGFloat = 12 * 1.25 + 8 * 72 / 96
let fixedIdentityAndSectionHeight: CGFloat =
    18 * 1.25 + 6 * 72 / 96 // Name line and its bottom gap.
    + 2 * 8.5 * 1.4 + 3 * 72 / 96 // Two fixed contact rows and their gap.
    + 18.5 * 72 / 96 + sectionPillHeight / 2 + 5 * 72 / 96 // Fixed contact-to-heading-center distance, half title pill, bottom gap.
    + 3 * (sectionPillHeight + 5 * 72 / 96) // Three remaining section titles and bottom gaps.

func headerLines(_ header: (String, String, String), widths: [CGFloat], font: CGFloat, measurer: TextMeasurer) -> Int {
    zip([header.0, header.1, header.2], widths).map { measurer.lineCount($0.0, size: font, width: $0.1) }.max() ?? 1
}

func groupsFor(_ scenario: Scenario, texts: (skills: [String], work: [String], projects: [ExperienceProject], education: [String])) -> [[String]] {
    let workGroups = split(texts.work, into: scenario.workCount)
    let projectGroups = Array(texts.projects.prefix(scenario.projectCount)).map(\.bullets)
    let allPool = texts.skills + texts.work + texts.projects.flatMap(\.bullets) + texts.education
    let extras = (0..<scenario.extraBullets).map { allPool[$0 % allPool.count] }
    var lists = [texts.skills + extras]
    lists += workGroups
    lists += projectGroups
    lists += [texts.education]
    return lists
}

func pageHeight(
    body: CGFloat,
    profile: Profile,
    scenario: Scenario,
    texts: (skills: [String], work: [String], projects: [ExperienceProject], education: [String]),
    measurer: TextMeasurer
) -> CGFloat {
    let lists = groupsFor(scenario, texts: texts)
    let internalBulletGaps = lists.reduce(0) { $0 + max(0, $1.count - 1) }
    let entryFont = body + 0.5

    let workRows = split(texts.work, into: scenario.workCount).indices.map { index in
        headerLines(workHeaders[index], widths: [threeColumnWidth, threeColumnWidth, threeColumnWidth], font: entryFont, measurer: measurer)
    }
    let projectRows = texts.projects.prefix(scenario.projectCount).map {
        headerLines(($0.name, $0.role, $0.date), widths: [threeColumnWidth, threeColumnWidth, threeColumnWidth], font: entryFont, measurer: measurer)
    }
    let educationRow = headerLines(educationHeader, widths: educationWidths, font: entryFont, measurer: measurer)
    let headerRowCount = workRows.reduce(0, +) + projectRows.reduce(0, +) + educationRow
    let bulletLines = lists.flatMap { $0 }.reduce(0) { $0 + measurer.lineCount($1, size: body, width: bulletTextWidth) }
    let listCount = lists.count

    return fixedIdentityAndSectionHeight
        + CGFloat(headerRowCount) * entryFont * profile.head
        + CGFloat(scenario.workCount + scenario.projectCount + 1) * (7 * 72 / 96) // Three-column row padding.
        + CGFloat(bulletLines) * body * profile.line
        + CGFloat(internalBulletGaps) * body * profile.bullet
        + 3 * body * profile.section
        + CGFloat(listCount) * (4 * 72 / 96) // Approximate 2px top/bottom margin per bullet list.
}

func fittedFont(
    profile: Profile,
    scenario: Scenario,
    texts: (skills: [String], work: [String], projects: [ExperienceProject], education: [String]),
    measurer: TextMeasurer
) -> (body: CGFloat, blankMM: CGFloat)? {
    for hundredths in stride(from: 1050, through: 850, by: -1) {
        let body = CGFloat(hundredths) / 100
        let height = pageHeight(body: body, profile: profile, scenario: scenario, texts: texts, measurer: measurer)
        if height <= availableHeight {
            return (body, (availableHeight - height) * 25.4 / 72)
        }
    }
    return nil
}

func run() throws {
    let htmlPath = CommandLine.arguments.dropFirst().first ?? "prototypes/a4-spacing-algorithm-demo-v23.html"
    let texts = try sourceText(path: htmlPath)
    guard texts.skills.count == 4, texts.work.count == 5, texts.projects.count == 3 else {
        fputs("Could not read sample bullets from \(htmlPath): skills=\(texts.skills.count), work=\(texts.work.count), projects=\(texts.projects.count)\n", stderr)
        exit(1)
    }
    let measurer = TextMeasurer()
    for profile in profiles {
        assert(profile.line >= 1.25 && profile.line <= 1.5)
        assert(profile.head >= 1.2 && profile.head <= 1.4)
        assert(profile.bullet * 8.5 >= 0.75 && profile.bullet * 10.5 <= 2.25)
        assert(profile.section * 8.5 >= 5 && profile.section * 10.5 <= 10)
    }
    let scenarios = (1...3).flatMap { work in
        (1...3).flatMap { projects in
            [0, 6, 12, 18].map { extra in Scenario(workCount: work, projectCount: projects, extraBullets: extra) }
        }
    }

    print("样本：v23中的正文样稿；CoreText使用PingFang SC和Times New Roman测字宽。")
    print("假设：联系区固定两行；字号8.50–10.50pt；纸面可写高度279mm；每段真实内容保留。")
    print("说明：行高和CSS边距仍按公式估算，CoreText折行不等同浏览器最终排版。")

    var monotoneChecks = 0
    for scenario in scenarios {
        for profile in profiles {
            var previousHeight: CGFloat = -.infinity
            for hundredths in 850...1050 {
                let body = CGFloat(hundredths) / 100
                let height = pageHeight(body: body, profile: profile, scenario: scenario, texts: texts, measurer: measurer)
                assert(height + 0.0001 >= previousHeight, "Page height decreased as font size increased")
                previousHeight = height
                monotoneChecks += 1
            }
        }
    }
    print("字号每次增加0.01pt时，模拟占高没有反向下降：\(monotoneChecks)次检查通过。")

    var volumeChecks = 0
    let volumeProfiles = profiles.filter { ["适中偏紧", "中间", "偏舒展"].contains($0.name) }
    for work in 1...3 {
        for projects in 1...3 {
            for profile in volumeProfiles {
                var previousFont: CGFloat?
                var alreadyOver = false
                for extra in 0...6 {
                    let scenario = Scenario(workCount: work, projectCount: projects, extraBullets: extra)
                    let result = fittedFont(profile: profile, scenario: scenario, texts: texts, measurer: measurer)
                    if alreadyOver { assert(result == nil, "Page started fitting again after adding more bullets") }
                    if let previousFont, let result { assert(result.body <= previousFont) }
                    previousFont = result?.body
                    alreadyOver = result == nil
                    volumeChecks += 1
                }
            }
        }
    }
    print("工作/项目各1–3段时，逐条增加0–6个要点没有让字号反向变大或让超页稿重新塞回：\(volumeChecks)次检查通过。")

    for profile in profiles {
        var maxFont = 0
        var reduced = 0
        var overflow = 0
        var chosenFonts: [CGFloat] = []
        var blankAmounts: [CGFloat] = []

        for scenario in scenarios {
            let result = fittedFont(profile: profile, scenario: scenario, texts: texts, measurer: measurer)
            if let result {
                chosenFonts.append(result.body)
                blankAmounts.append(result.blankMM)
                if result.body == 10.5 { maxFont += 1 } else { reduced += 1 }
            } else {
                overflow += 1
            }
        }

        let meanFont = chosenFonts.reduce(0, +) / CGFloat(max(chosenFonts.count, 1))
        let meanBlank = blankAmounts.reduce(0, +) / CGFloat(max(blankAmounts.count, 1))
        print("\(profile.name)：10.50pt可用\(maxFont)/\(scenarios.count)，需缩小\(reduced)，8.50pt仍超页\(overflow)；可排场景平均字号\(String(format: "%.2f", Double(meanFont)))pt，平均剩白\(String(format: "%.1f", Double(meanBlank)))mm。")
    }

    print("\n工作/项目各2段，增加正文要点：")
    for profile in profiles {
        let rows = [0, 6, 12, 18].map { extra -> String in
            let scenario = Scenario(workCount: 2, projectCount: 2, extraBullets: extra)
            guard let result = fittedFont(profile: profile, scenario: scenario, texts: texts, measurer: measurer) else {
                return "+\(extra)条→超页"
            }
            return "+\(extra)条→\(String(format: "%.2f", Double(result.body)))pt，余\(String(format: "%.1f", Double(result.blankMM)))mm"
        }
        print("\(profile.name)：" + rows.joined(separator: "；"))
    }

    print("\n工作/项目各2段时，最多还能增加多少条模拟要点并保持8.50pt以上：")
    for profile in profiles {
        var lastFit = -1
        for extra in 0...24 {
            let scenario = Scenario(workCount: 2, projectCount: 2, extraBullets: extra)
            guard fittedFont(profile: profile, scenario: scenario, texts: texts, measurer: measurer) != nil else { break }
            lastFit = extra
        }
        print("\(profile.name)：最多 +\(lastFit) 条")
    }

    print("\n原样稿、无额外要点：工作段数 × 项目段数；显示字号和纸底剩白。")
    for work in 1...3 {
        for projects in 1...3 {
            let scenario = Scenario(workCount: work, projectCount: projects, extraBullets: 0)
            let values = profiles.map { profile -> String in
                guard let result = fittedFont(profile: profile, scenario: scenario, texts: texts, measurer: measurer) else {
                    return "\(profile.name)超页"
                }
                return "\(profile.name) \(String(format: "%.2f", Double(result.body)))pt/余\(String(format: "%.1f", Double(result.blankMM)))mm"
            }
            print("\(work)×\(projects)：" + values.joined(separator: "；"))
        }
    }

    print("\n10.50pt时的联动间距（都需落在候选范围内）：")
    for profile in profiles {
        let body: CGFloat = 10.5
        print("\(profile.name)：正文行高\(String(format: "%.2f", Double(body * profile.line)))pt；三栏行高\(String(format: "%.2f", Double((body + 0.5) * profile.head)))pt；要点空隙\(String(format: "%.2f", Double(body * profile.bullet)))pt；标题前\(String(format: "%.2f", Double(body * profile.section)))pt。")
    }
}

do {
    try run()
} catch {
    fputs("测试失败：\(error)\n", stderr)
    exit(1)
}

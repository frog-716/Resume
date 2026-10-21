# Resume macOS App

`build-dev-app.sh` 从当前 checkout 构建 `out/Resume.app`。脚本把 `server/`、`src/domain/` 与已构建的 `dist/` 放进 App 的 `Contents/Resources/`，并把当前 `node` 可执行文件复制到 `Resources/Runtime/node`。它会拒绝复制含 `.private` 目录或符号链接的服务/前端目录。`server/index.mjs` 的 `../src/domain/*.mjs` 导入会对应到 `Resources/src/domain/*.mjs`。

服务按下面的契约启动：

```text
node <app resource>/server/index.mjs
RESUME_DATA_DIR=~/Library/Application Support/Resume
stdout: RESUME_READY http://127.0.0.1:<port>
```

启动器只接受 `127.0.0.1` 的就绪地址，并核对服务进程的监听地址也是单独的 `127.0.0.1:<port>`，然后才用 Chrome `--app=<url>` 打开无地址栏专用窗口。每次启动使用 `Application Support/Resume/ChromeProfiles/` 下单独的临时 Chrome 用户目录，关闭窗口或退出 Resume 时会清理自启的 Chrome 与服务进程；不会复用或结束用户平时使用的 Chrome 进程。Resume 自身的数据目录固定传入 `RESUME_DATA_DIR`。

只要服务、领域模块、前端或可运行的 Node 缺一项，构建脚本仍会生成可检查的启动壳，但返回退出码 `2` 并标为 `STATUS=INCOMPLETE`；这不是一次完整构建或启动成功。补齐缺失输入后，再运行：

```sh
./native/launcher/build-dev-app.sh
```

成功构建后可双击 `out/Resume.app`。`Contents/MacOS/ResumeLauncher --check-resources` 只检查服务与前端是否已装入包，不会启动服务或打开 Chrome。

开发机当前的 Node 可执行文件和 `libnode` 会被带入 Resources。Homebrew Node 依赖的 OpenSSL、ICU 等动态库仍指向本机 Homebrew 路径，因此这个包暂时不是独立分发包；若随包 Node 无法运行，启动器会回退使用本机安装的 Node。发布前需要一并整理并签名这些依赖库，或改用可独立运行的 Node 发布物。

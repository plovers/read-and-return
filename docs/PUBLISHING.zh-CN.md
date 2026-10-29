# 首次发布到 GitHub 与 Obsidian 社区

本指南于 2026-10-29 对照官方文档核查。当前源代码版本是 0.1.5；首次公开发布可以沿用 0.1.5，不要求改成 1.0.0。

## 1. 修改你自己的公开资料

最终名称已确定为 **Read & Return**，插件 ID 为 **read-and-return**，版本保留 **0.1.5**。源码、测试、样式、构建及包路径已统一更新。目录搜索暂未发现此 ID，最终可用性以提交时验证为准。

你只需要修改以下个人信息：

| 位置 | 修改内容 |
| --- | --- |
| 根目录 `manifest.json` 的 `author` 字段 | 将 `Read & Return contributors` 换成公开作者名 |
| 根目录 `manifest.json` 可选 `authorUrl` 字段 | 可添加 `https://github.com/你的用户名`，注意 JSON 逗号 |
| 根目录 `LICENSE` 第 3 行 | 将 `Read & Return contributors` 换成版权署名 |
| 下文 Git 命令中的 `YOUR_PUBLIC_NAME` | Git 提交显示名 |
| 下文 `YOUR_GITHUB_NOREPLY_EMAIL` | GitHub Settings → Emails 中的 noreply 邮箱 |
| 下文 URL 的 `YOUR_USERNAME/YOUR_REPOSITORY` | GitHub 用户名与仓库名，仓库名建议 read-and-return |

README 无硬编码的 GitHub 用户名，无需全局替换。改完 manifest 后重新运行 `npm run release`，不要只改发布包里的副本。

旧项目 Note Navigator 的 ID 已被另一社区插件使用，因此这次换名。旧开发包保留在本地；首次公开只复制 `release/0.1.5/read-and-return/`。升级测试时先禁用旧插件，新 ID 不自动迁移外观设置。

MIT 协议已添加；提交前检查任何借用代码的许可和署名义务。
## 2. 完成安装验收并构建

在项目根目录打开 PowerShell，安装 Node.js 22 后执行：

```powershell
npm ci
npm run release
```

`release` 已包含生产构建、TypeScript 检查、测试和打包。当前路径为 `release/0.1.5/read-and-return/`。

按 [开发与验收](DEVELOPMENT.md) 测试真实长笔记，分别记录桌面阅读、实时预览、源码模式、手机/iOS 阅读及编辑器的结果。测试最低声明版本 1.8.7；如果实际只支持更高版本，同步 manifest 与 versions.json。现在自动化覆盖不等于真机验收通过。

README 已有两种语言的原创流程图，明确标注为示意。正式发布建议再补两张真实截图：手机悬浮控件及更多菜单、桌面命令面板/设置。用不含隐私的示例笔记截图，放入 `docs/images/`，从两个 README 引用，不能把示意图冒充真机截图。

## 3. 只把当前快照作为 GitHub 初始提交

本地目前没有配置 Git remote。推荐建立一个新的发布工作副本：复制当前文件，不复制 `.git`，再 `git init`。公开仓库只含一条初始提交，原开发仓库留在本机，旧历史不会被推送。无需删除原目录，也无需强制推送。

先完成第 1 步作者设置，然后在原项目根目录执行下面的 PowerShell。目标目录必须不存在，存在时命令会停止；再次导出请换一个新目录名。

```powershell
$publishRoot = Join-Path (Get-Location) '.qa/github-initial'
if (Test-Path -LiteralPath $publishRoot) { throw '目标已存在，请换一个新目录名。' }
New-Item -ItemType Directory -Path $publishRoot | Out-Null
$publishItems = @(
  '.gitignore', 'README.md', 'README.zh-CN.md', 'LICENSE', 'CHANGELOG.md',
  'manifest.json', 'versions.json', 'package.json', 'package-lock.json',
  'tsconfig.json', 'esbuild.config.mjs', 'styles.css', 'src', 'tests', 'scripts', 'docs'
)
foreach ($item in $publishItems) {
  Copy-Item -LiteralPath $item -Destination $publishRoot -Recurse
}
$publishManifest = Get-Content manifest.json -Raw | ConvertFrom-Json
$versionFolder = Join-Path $publishRoot "release/$($publishManifest.version)"
New-Item -ItemType Directory -Path $versionFolder -Force | Out-Null
Copy-Item -LiteralPath "release/$($publishManifest.version)/$($publishManifest.id)" -Destination $versionFolder -Recurse
Set-Location -LiteralPath $publishRoot
```

这个副本只包含当前运行包，不包含旧版本包、旧 `.git`、node_modules、`.qa` 或私人参考图片。原开发文档中有对本地 `references/` 的文字引用，公开前可以移除这些内部评审段落或改写为独立说明；不要未经检查上传个人参考材料。

旧 Git 历史与 CHANGELOG 是两回事。保留 CHANGELOG 不会带回 Git 提交。`versions.json` 原本记录了本地开发版本，首次公开发布可在这个新副本中只保留当前版本映射，避免暗示旧 GitHub Release 存在：

```powershell
$initialVersions = [ordered]@{}
$initialVersions[$publishManifest.version] = $publishManifest.minAppVersion
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'versions.json'), ($initialVersions | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
npm ci
npm run release
```

初始化仓库；把大写占位内容替换成自己的公开资料。若希望隐藏邮箱，在 GitHub **Settings → Emails** 获取你自己的 noreply 邮箱。

```powershell
git init -b main
git config user.name 'YOUR_PUBLIC_NAME'
git config user.email 'YOUR_GITHUB_NOREPLY_EMAIL'
git add .
git diff --cached --stat
```

检查暂存内容，确认没有私密资料后执行：

```powershell
git commit -m "Initial public release 0.1.5"
git rev-list --count HEAD
git log --oneline --all
```

提交数应为 **1**，日志只有初始提交。今后从这个新目录继续开发，或者发布后重新 clone GitHub 仓库；不要把原仓库的历史分支或旧标签推入公开仓库。

## 4. 创建公开 GitHub 仓库并上传

1. 登录 GitHub，右上角 **+ → New repository**。
2. Repository name 填最终仓库名，建议与新 ID 一致。
3. 选择 **Public**，填写简短英文 Description。
4. 不勾选初始化 README、.gitignore 或 License，本地已经准备好这些文件。
5. 点击 **Create repository**，复制新仓库的 HTTPS 地址。
6. 在上一步的新副本目录执行（替换 URL）：

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

浏览器完成 GitHub 登录授权。不要把访问令牌写入 remote URL。刷新仓库首页：默认显示英文 README，点击顶部“简体中文”进入中文版。检查配图和链接正常、Commits 只有 1 条。仓库 Settings 中确认默认分支为 main。

如果 GitHub 上已经有非空仓库，以上普通 push 可能拒绝合并：优先创建另一个全新的空仓库，不要直接执行 `--force`。当前指南针对首次建仓。

## 5. 创建 GitHub Release

在仓库主页打开 **Releases → Draft a new release**：

1. Tag 填 **`0.1.5`**，在 main 上创建标签。不要填 `v0.1.5`，必须与 manifest.version 完全一致。
2. Title 可以填 `0.1.5 — Initial public release`。
3. 说明介绍首次公开版本，包括顶部/底部跳转与返回、临时点、前进后退、移动控件，以及实际验收情况。
4. 从刚生成的 `release/0.1.5/<最终插件ID>/` 中上传 **三个独立附件**：`main.js`、`manifest.json`、`styles.css`。不要只上传 ZIP，不要上传 TypeScript 源码替代 main.js。
5. 完成验收后发布正式 Release，不要停留在 Draft；用于正式安装的版本不要标成 prerelease。
6. 检查下载区存在三个具名附件，并确认附件 manifest 的版本、ID 和默认分支一致。

根目录 `main.js` 被 .gitignore 忽略是正常的：社区安装需要 GitHub Release 附件。代码仓库包含源码，不能用附件替代可审查的源码。

## 6. 提交到 Obsidian 社区目录

按当前官方流程，通过 Community 网站提交：

1. 打开 [community.obsidian.md](https://community.obsidian.md)，点击 **Sign in**，使用你的 Obsidian 账号登录。
2. 在 Community profile 的 **GitHub → Connect** 连接你的 GitHub 账号，完成授权。
3. 在侧栏 **Plugins → New plugin** 打开提交表单。
4. 填写公开的 GitHub 仓库完整 URL，Owner 选择自己。
5. 阅读开发者政策，确认维护责任，然后 **Submit**。

网站会读取默认分支 HEAD 的 manifest，所以不能只修改本地或只上传附件。插件 ID 必须未被占用，且不能包含 obsidian。提交时也会要求可用的对应版本 Release。

## 7. 跟进扫描结果并发布

在自己的插件管理页查看自动审查结果；有错误时修正代码或元数据，增加版本号，重新构建并发布新的 GitHub Release，再检查结果。页面允许编辑描述和选择 **Publish**，但存在未解决错误时，插件不会变成 Obsidian 内可安装状态。建议在个人页启用 **Action required notifications**。

通过后，在 Obsidian **设置 → 第三方插件 → 浏览** 搜索最终名字，验证安装、启用和功能。两个 README 中的未上架提示应按实际状态更新，并加入正式安装说明；没有验证前不要提前宣称已上架。

以后更新通常无需重新提交新插件：同步 package.json、package-lock.json、manifest.json、versions.json 和 CHANGELOG，运行 release，提交并 push，再创建与版本一致的标签和附件。

## 发布前最后核对

- [ ] 最终名称和唯一 ID 已确定，源码、测试、包目录及 README 一致。
- [ ] manifest 的 author、LICENSE 的版权人改成你的公开署名。
- [ ] GitHub URL 中的用户名/仓库名正确，没有占位符。
- [ ] MIT 及第三方许可声明齐全。
- [ ] 构建、测试、真机验收完成，最低版本声明准确。
- [ ] README 英文默认，中文切换和图片可用。
- [ ] 新公开仓库初始提交数为 1，没有旧开发提交或私密资料。
- [ ] 正式 Release 标签与 manifest 一致，三个运行附件齐全。
- [ ] 绑定正确 GitHub 账号，再向 Community 提交。

## 官方依据

- [提交插件](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)：仓库文件、Release 与提交要求。
- [账号绑定与新增插件](https://docs.obsidian.md/community-directory/set-up-and-claim)：GitHub Connect、Plugins → New plugin。
- [插件提交要求](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)：版本兼容性、描述及平台要求。
- [开发者政策](https://docs.obsidian.md/community-directory/developer-policies)：许可证、隐私披露与维护责任。



# GitHub 连接指南

本项目已初始化为本地Git仓库。按照以下步骤连接到GitHub。

## 步骤 1: 在GitHub上创建仓库

1. 登录 [GitHub.com](https://github.com)
2. 点击右上角 `+` → `New repository`
3. 填写以下信息：
   - **Repository name**: `bgmi` (或你喜欢的名称)
   - **Description**: BGmi - Anime Download Tool (或自定义描述)
   - **Visibility**: 选择 `Public` 或 `Private`
   - **勾选**: "Add a README file" - 不勾选（我们已有README）
   - **勿勾选**: ".gitignore" 和 "license"
4. 点击 `Create repository`

## 步骤 2: 连接本地仓库到GitHub

复制以下命令之一并在项目目录运行：

### 如果使用 HTTPS（推荐初学者）:
```powershell
cd C:\Users\rtgtx\Desktop\bgmi
git remote add origin https://github.com/YOUR_USERNAME/bgmi.git
git branch -M main
git push -u origin main
```

### 如果使用 SSH（需要配置SSH密钥）:
```powershell
cd C:\Users\rtgtx\Desktop\bgmi
git remote add origin git@github.com:YOUR_USERNAME/bgmi.git
git branch -M main
git push -u origin main
```

## 步骤 3: 首次推送时的认证

**使用HTTPS方式时:**
- 系统会提示输入GitHub用户名和密码
- 对于2FA开启的账户，密码应该是Personal Access Token (PAT)
- 获取PAT: GitHub Settings → Developer settings → Personal access tokens → Generate new token
  - 勾选 `repo` 权限
  - 复制token，在push时用作密码

**使用SSH方式时:**
- 需要先生成并配置SSH密钥
- 运行: `ssh-keygen -t ed25519 -C "your_email@example.com"`
- 按照提示完成，然后在GitHub Settings → SSH keys 添加公钥

## 替换说明

记得用你的实际GitHub用户名替换 `YOUR_USERNAME`！

例如，如果用户名是 `john-doe`，命令应该是：
```powershell
git remote add origin https://github.com/john-doe/bgmi.git
```

## 验证连接

连接成功后，运行以下命令验证：
```powershell
git remote -v
```

应该看到类似输出：
```
origin  https://github.com/YOUR_USERNAME/bgmi.git (fetch)
origin  https://github.com/YOUR_USERNAME/bgmi.git (push)
```

## 后续开发

现在你可以：
1. 创建新分支进行开发: `git checkout -b feature/your-feature`
2. 提交更改: `git commit -m "描述你的更改"`
3. 推送到GitHub: `git push origin feature/your-feature`
4. 在GitHub上创建Pull Request并merge

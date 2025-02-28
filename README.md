# Text-to-Speech Web Application with AWS Polly

这是一个使用 Flask 和 AWS Polly 构建的文本转语音 Web 应用程序。用户可以输入文本，应用程序会将其转换为自然语音。用户可以点击整段文字或单个单词来听取发音。

## 功能特点

- 输入文本并转换为自然语音
- 点击整段文字播放该段落的语音
- 点击单个单词播放该单词的语音
- **语速控制**：可以调整语音速度（0.5-1.0倍速）
- 响应式设计，适合各种设备
- **本地缓存功能**：使用 MD5 哈希避免重复调用 AWS Polly，节省成本
- 使用 AWS Polly 的 Kevin 语音（男声，美式英语）

## 技术栈

- **后端**: Flask (Python)
- **前端**: HTML, CSS, JavaScript
- **文本转语音**: AWS Polly (Kevin 语音)
- **语速控制**: SSML (Speech Synthesis Markup Language)
- **缓存机制**: MD5 哈希 + 本地文件存储

## 安装步骤

1. 克隆仓库:
   ```
   git clone https://github.com/yourusername/text-to-speech-app.git
   cd text-to-speech-app
   ```

2. 创建并激活虚拟环境:
   ```
   python -m venv venv
   source venv/bin/activate  # 在 Windows 上使用 venv\Scripts\activate
   ```

3. 安装依赖:
   ```
   pip install -r requirements.txt
   ```

4. 配置 AWS 凭证:
   - 创建 `.env` 文件并添加以下内容:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   ```

## 使用方法

1. 启动应用程序:
   ```
   python app.py
   ```

2. 在浏览器中访问:
   ```
   http://localhost:5000
   ```

3. 在文本框中输入或粘贴文本。

4. 使用语速滑块调整语音速度（0.5 = 半速，1.0 = 正常速度）。

5. 点击 "Convert to Speech" 按钮。

6. 处理完成后，您可以:
   - 点击整段文字播放该段落的语音
   - 点击单个单词播放该单词的语音

## 语速控制

应用程序使用 SSML (Speech Synthesis Markup Language) 来控制语音速度：

- 滑块范围从 0.5（半速）到 1.0（正常速度）
- 默认设置为 0.8（80%的正常速度）
- 语速设置会影响所有音频生成，包括整段文字和单个单词

## 缓存功能

应用程序使用 MD5 哈希来唯一标识每个文本和语速组合。当用户请求转换文本时：

1. 系统首先计算文本、语音和语速的 MD5 哈希值
2. 检查是否已存在具有该哈希值的音频文件
3. 如果存在，直接使用缓存的音频文件，避免调用 AWS Polly API
4. 如果不存在，调用 AWS Polly API 生成新的音频文件并缓存

缓存状态会在用户界面中显示，让用户知道是使用了缓存的音频还是生成了新的音频。

## AWS Polly 配置

确保您的 AWS 账户有权限使用 AWS Polly 服务。您可能需要在 AWS 控制台中配置适当的 IAM 权限。

## 注意事项

- AWS Polly 是一项付费服务，请查看 [AWS Polly 定价](https://aws.amazon.com/polly/pricing/) 了解详情。
- 应用程序会在 `static/audio` 目录中存储生成的音频文件。您可能需要定期清理此目录以节省空间。
- 缓存功能可以显著减少 AWS Polly API 的调用次数，从而降低成本。

## 许可证

MIT
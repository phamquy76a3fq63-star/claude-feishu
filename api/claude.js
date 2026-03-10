module.exports = async function(req, res) {
  const params = req.body || {};

  // 最优先处理 Challenge 验证，不加载任何依赖
  if (params.challenge) {
    return res.json({ challenge: params.challenge });
  }

  // 懒加载，仅在需要时才加载 SDK
  const lark = require('@larksuiteoapi/node-sdk');
  const axios = require('axios');

  const APPID = process.env.APPID;
  const SECRET = process.env.SECRET;
  const CLAUDE_KEY = process.env.CLAUDE_KEY;
  const BOTNAME = process.env.BOTNAME || 'Claude';

  const client = new lark.Client({ appId: APPID, appSecret: SECRET });

  async function askClaude(question) {
    const response = await axios.post(
      'https://www.openclaudecode.cn/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: question }]
      },
      {
        headers: {
          'x-api-key': CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
      }
    );
    return response.data.content[0].text;
  }

  async function reply(messageId, content) {
    await client.im.message.reply({
      path: { message_id: messageId },
      data: {
        content: JSON.stringify({ text: content }),
        msg_type: 'text'
      }
    });
  }

  const event = params.event;
  if (!event) return res.json({ msg: 'no event' });

  const messageType = event.message?.message_type;
  if (messageType !== 'text') return res.json({ msg: 'not text' });

  let text = JSON.parse(event.message.content).text;
  const messageId = event.message.message_id;

  if (event.message.chat_type === 'group') {
    if (!text.includes(`@${BOTNAME}`)) return res.json({ msg: 'not mentioned' });
    text = text.replace(new RegExp(`@${BOTNAME}`, 'g'), '').trim();
  }

  // 先返回 200，再异步处理
  res.json({ msg: 'success' });

  try {
    const answer = await askClaude(text);
    await reply(messageId, answer);
  } catch (e) {
    await reply(messageId, `错误：${e.message}`);
  }
};

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tls from 'node:tls'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readDotEnvFile() {
  const result = {}
  try {
    const envPath = path.resolve(__dirname, '.env')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eqIdx = line.indexOf('=')
        if (eqIdx === -1) continue
        const key = line.slice(0, eqIdx).trim()
        const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
        result[key] = val
      }
    }
  } catch {}
  return result
}

function sendSmtpMail({ host, port, user, pass, from, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const cleanPass = String(pass || '').replace(/\s+/g, '')
    let socket = null
    let buffer = ''
    let step = 0
    let finished = false

    const fail = (err) => {
      if (finished) return
      finished = true
      try {
        socket?.destroy()
      } catch {}
      reject(err instanceof Error ? err : new Error(String(err)))
    }

    const succeed = () => {
      if (finished) return
      finished = true
      try {
        socket?.end()
      } catch {}
      resolve(true)
    }

    const sendLine = (line) => {
      socket.write(`${line}\r\n`)
    }

    const buildMimeMessage = () => {
      const boundary = `----=_RegQuest_${Date.now()}`
      return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        '',
        `--${boundary}--`,
        '',
        '.',
      ].join('\r\n')
    }

    const handleResponse = (code, fullResp) => {
      if (code >= 400) {
        return fail(new Error(`SMTP Error (${code}): ${fullResp.trim()}`))
      }

      if (step === 0 && code === 220) {
        step = 1
        sendLine('EHLO regquest.local')
      } else if (step === 1 && code === 250) {
        if (Number(port) === 587 && !socket.encrypted) {
          step = 2
          sendLine('STARTTLS')
        } else {
          step = 3
          sendLine('AUTH LOGIN')
        }
      } else if (step === 2 && code === 220) {
        const tlsSocket = tls.connect(
          { socket, servername: host },
          () => {
            socket = tlsSocket
            attachListeners(tlsSocket)
            step = 1
            sendLine('EHLO regquest.local')
          }
        )
        tlsSocket.on('error', fail)
      } else if (step === 3 && code === 334) {
        step = 4
        sendLine(Buffer.from(user, 'utf-8').toString('base64'))
      } else if (step === 4 && code === 334) {
        step = 5
        sendLine(Buffer.from(cleanPass, 'utf-8').toString('base64'))
      } else if (step === 5 && code === 235) {
        step = 6
        sendLine(`MAIL FROM:<${user}>`)
      } else if (step === 6 && code === 250) {
        step = 7
        sendLine(`RCPT TO:<${to}>`)
      } else if (step === 7 && code === 250) {
        step = 8
        sendLine('DATA')
      } else if (step === 8 && code === 354) {
        step = 9
        sendLine(buildMimeMessage())
      } else if (step === 9 && code === 250) {
        step = 10
        sendLine('QUIT')
        succeed()
      }
    }

    const attachListeners = (sock) => {
      sock.setEncoding('utf8')
      sock.setTimeout(15000, () => fail(new Error('SMTP connection timed out')))
      sock.on('data', (chunk) => {
        buffer += chunk
        const lines = buffer.split('\r\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.length >= 3 && line[3] !== '-') {
            const code = parseInt(line.slice(0, 3), 10)
            if (!Number.isNaN(code)) {
              handleResponse(code, line)
            }
          }
        }
      })
      sock.on('error', fail)
    }

    if (Number(port) === 465) {
      socket = tls.connect({ host, port: Number(port), servername: host })
      attachListeners(socket)
    } else {
      socket = net.connect({ host, port: Number(port) || 587 })
      attachListeners(socket)
    }
  })
}

function regquestSmtpPlugin() {
  return {
    name: 'regquest-smtp-plugin',
    configureServer(server) {
      server.middlewares.use('/__smtp/send-otp', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ detail: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')
          try {
            const payload = JSON.parse(body || '{}')
            const { toEmail, toName, username, otpCode } = payload
            const viteEnv = loadEnv('development', __dirname, '')
            const rawEnv = readDotEnvFile()
            const env = { ...viteEnv, ...rawEnv }

            const host = env.VITE_SMTP_HOST || 'smtp.gmail.com'
            const port = Number(env.VITE_SMTP_PORT || 465)
            const user = (env.VITE_SMTP_USER || '').trim()
            const pass = (env.VITE_SMTP_PASS || '').trim()
            const from = env.VITE_SMTP_FROM || `RegQuest USTP <${user}>`

            if (!user || !pass) {
              console.log(`\n[RegQuest SMTP] VITE_SMTP_USER / VITE_SMTP_PASS not set in .env. OTP for ${toEmail}: ${otpCode}\n`)
              res.statusCode = 200
              res.end(JSON.stringify({ sent: false, simulated: true }))
              return
            }

            const subject = 'RegQuest Password Reset Verification Code'
            const text = [
              `Hello ${toName || username || 'User'},`,
              '',
              `Your 6-digit RegQuest password reset verification code is: ${otpCode}`,
              '',
              'This code will expire in 15 minutes.',
              'If you did not request a password reset, please ignore this email.',
            ].join('\r\n')

            const html = `
              <div style="font-family:Inter,Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;color:#1e293b;">
                <div style="background:#1a237e;color:#ffffff;padding:16px 20px;border-radius:12px;margin-bottom:18px;">
                  <h2 style="margin:0;font-size:18px;">RegQuest Account Recovery</h2>
                  <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1;">University of Science and Technology of Southern Philippines</p>
                </div>
                <p style="font-size:14px;">Hello <strong>${toName || username}</strong>,</p>
                <p style="font-size:14px;color:#475569;">Use the 6-digit verification code below to reset your RegQuest password:</p>
                <div style="margin:20px 0;padding:16px;background:#f8fafc;border:2px dashed #1a237e;border-radius:12px;text-align:center;">
                  <span style="font-size:28px;font-weight:800;letter-spacing:8px;color:#1a237e;">${otpCode}</span>
                </div>
                <p style="font-size:12px;color:#94a3b8;">This code expires in 15 minutes. If you did not request this reset, you can safely ignore this email.</p>
              </div>
            `

            await sendSmtpMail({
              host,
              port,
              user,
              pass,
              from,
              to: toEmail,
              subject,
              html,
              text,
            })

            res.statusCode = 200
            res.end(JSON.stringify({ sent: true }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ sent: false, detail: err.message || 'SMTP send failed' }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), regquestSmtpPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

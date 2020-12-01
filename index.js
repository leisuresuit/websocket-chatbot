'use strict'

const http = require('http')
const https = require('https')
const axios = require('axios')
const WebSocket = require('ws')
const port = process.env.PORT || 3000
const crypto = require("crypto");

const server = http.createServer()

const wss = new WebSocket.Server({ server })
// When new socket connected, this will fire up
// First argument is an 'individual' socket ('ws')
// Think of a websocket as a connected endpoint
// Every client that connects will call this on function to fire
wss.on('connection', (ws, req) => {
  const sessionId = generateSessionId()

  ws.on('message', (message) => {
    switch (message.toLowerCase()) {
      case "exit":
      case "goodbye":
      case "bye":
      case "bye-bye":
        const response = "Goodbye!"
        getAudio(response, audioContent => { sendResponse(ws, response, audioContent); ws.close() })
        break;
      case "start over":
      case "start again":
      case "restart":
        sendMessage("again", ws, sessionId)
      default:
        sendMessage(message, ws, sessionId)
    }
  })

  startChat(ws, sessionId)
})

server.listen(port, () => console.log(`Listening on port: ${server.address().port}`))

function generateSessionId() {
  return crypto.randomBytes(16).toString("hex")
}

function startChat(ws, sessionId) {
  sendMessage("hi", ws, sessionId)
}

const googleAPIAccesstoken = "Bearer ya29.a0AfH6SMA4jNOu9ACtAOQXwIF9dofQlQvXZ7btrPzbH_9rxhNgbxEh4Zcjxz1GC8W_E0DeVMHX5EJa8vnQ3tHpIu4c8o6Ni9HShBnswCbF4de2v4kHatro_VV8vn1EaUfho3254Uv1Ijm1iCSfukpjyc_NGxyQp4C9BRV1O2B0F04"

function sendMessage(input, ws, sessionId) {
  axios
    .post(
     `https://dialogflow.googleapis.com/v3beta1/projects/pp-devcos-cai-poc/locations/global/agents/99bbb32f-3595-4557-92d7-913c28eb12ad/sessions/${sessionId}:detectIntent`,
     // MTS chatbot
     // `https://www.te-alm-25578492009340946904095.qa.paypal.com/smartchat/open/chat-bot`,
      {
        queryInput: {
          text: {
            text: `${input}`
          },
          languageCode: "en"
        },
        queryParams: {
          timeZone: "America/Los_Angeles"
        }
        // MTS chatbot
        // request_timestamp: 1605847050283,
        // conversation_id: "8098af23-7cb1-4ee9-93a9-1764034a8e5d",
        // text: `${input}`
      },
      {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        headers: {
          "Authorization": `${googleAPIAccesstoken}`
        }
      }
    )
    .then(res => {
      console.log(`status: ${res.status}`)
      console.dir(res.data, {depth: null, colors: true})
      const msgs = res.data.queryResult.responseMessages
      // MTS chatbot
      // const msgs = res.data.messages
      const output = (msgs.length > 0) ? getResponse(msgs) : "Sorry, I do not understand."
      getAudio(output, audioContent => sendResponse(ws, output, audioContent))
    })
    .catch(error => {
      console.error(error)
      ws.send(
        JSON.stringify({
          text: `Sorry, there was a server error ${error.response.status}`,
          isSuccess: false
        })
      )
    })
}

function sendResponse(ws, text, audioContent) {
  if (audioContent != null) {
    ws.send(
      JSON.stringify({
        text: `${text}`,
        audioContent: `${audioContent}`
      })
    )
  } else {
    ws.send(
      JSON.stringify({
        text: `${text}`
      })
    )
  }
  const lowerCaseText = text.toLowerCase()
  if (
    lowerCaseText.includes("good bye") ||
    lowerCaseText.includes("good-bye") ||
    lowerCaseText.includes("goodbye")
  ) {
    ws.close()
  }
}

function getResponse(msgs) {
  var output = ""
  for (const i in msgs) {
    const msg = msgs[i]
    if (
      typeof msg.text !== 'undefined' &&
      typeof msg.text.text !== 'undefined'
    ) {
      if (output.length > 0) {
        output += "\n\n"
      }
      output += msg.text.text
    }
    // MTS chatbot
    // if (output != "") output += "\n\n"
    // output += msgs[i].replace(/(<([^>]+)>)/gi, "")
  }
  return output
}

function getAudio(text, lambda) {
  axios
    .post(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        input: {
          text: `${text}`
        },
        voice: {
          languageCode: "en-US",
          name: "en-US-Wavenet-H",
          ssmlGender: "FEMALE"
        },
        audioConfig: {
          audioEncoding: "MP3",
          effectsProfileId: [ "handset-class-device" ]
        }
      },
      {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        headers: {
          "Authorization": `${googleAPIAccesstoken}`
        }
      }
    )
    .then(res => {
      console.log(`audioContent status: ${res.status}`)
      const output = res.data.audioContent
      lambda(output)
    })
    .catch(error => {
      console.error(error)
      lambda(null)
    })
}

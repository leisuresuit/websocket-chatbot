'use strict'

const express = require('express')
const http = require('http')
const axios = require('axios')
const WebSocket = require('ws')
const app = express() // Get an application instance of 'express'
const port = process.env.PORT || 3000
const api = require('./api/answers.json')
const crypto = require("crypto");

let questions = api.map((item) => {
  return item.question
})

app.use(express.static('public'))

app.locals.appTitle = 'WebSocket ChatBot'

// Setup PUG as templating language
app.set('view engine', 'pug')

app.get('/', (req, res) => {
  res.render('index')
})

// Invoke express get method...
app.get('/api', (request, response) => {
  // Output the bot answers,
  response.json(api)
})

// Connect express app and the websocket server
//const server = http.createServer(app)
const server = http.createServer()

const wss = new WebSocket.Server({ server })
// When new socket connected, this will fire up
// First argument is an 'individual' socket ('ws')
// Think of a websocket as a connected endpoint
// Every client that connects will call this on function to fire
wss.on('connection', (ws, req) => {
  const sessionId = crypto.randomBytes(16).toString("hex");

  // Add listeners to the WebSocket
  ws.on('message', (message) => {
    switch (message.toLowerCase()) {
      case "exit":
      case "goodbye":
      case "bye":
        ws.send("Goodbye!");
        ws.close();
        break;
      default:
        // All socket clients are placed in an array
        wss.clients.forEach((client) => {
          sendMessage(message, client, sessionId)
        })
    }
  })

  sendMessage("hi", ws, sessionId)
})

// The express app should listen to this port
server.listen(port, () => console.log(`Listening on port: ${server.address().port}`))

function sendMessage(input, ws, session) {
  axios
    .post(
      `https://dialogflow.googleapis.com/v3beta1/projects/pp-devcos-cai-poc/locations/global/agents/af3180d5-2e17-4c79-a392-8f53ecf955f7/sessions/${session}:detectIntent`,
      {
        "queryInput": {
          "text": {
            "text": `${input}`
          },
          "languageCode": "en"
        },
        "queryParams": {
          "timeZone": "America/Los_Angeles"
        }
      },
      {
        headers: {
          "Authorization": "Bearer ya29.a0AfH6SMCJg8vqO8859fPN4mFIhIeJFHMBpL_jN6k_ASmndUKl6MT5h0PAlfPiXU1YDFHC2x17LHIPUR9lF04nodJIjjF3ywklZu7dqdF9LZHFTJke4I5Od0EMbcz1SF4XvbUd0iKa-qkIHsq78w6TjoSk_xbWbmX0gjU"
        }
      }
    )
    .then(res => {
      console.log(`status: ${res.status}`)
      const output = res.data.queryResult.responseMessages[0].text.text
      console.log(`output: ${output}`)
      ws.send(`${output}`)
    })
    .catch(error => {
      console.error(error)
    })
}

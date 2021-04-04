import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import axios from 'axios'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const { writeFile, readFile, unlink } = require('fs').promises

require('colors')

let Root
try {
  // eslint-disable-next-line import/no-unresolved
  Root = require('../dist/assets/js/ssr/root.bundle').default
} catch {
  console.log('SSR not found. Please run "yarn run build:ssr"'.red)
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', '73f48281-bfe9-11e9-9a23-1914400a8e72')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser(),
  setHeaders
]

middleware.forEach((it) => server.use(it))

server.get('/api/v1/hello', (req, res) => {
  res.json({ status: 'Ok' })
})

server.get('/api/v1/users', async (req, res) => {
  const users = await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
    .then((text) => JSON.parse(text))
    .catch(async () => {
      const url = `https://jsonplaceholder.typicode.com/users`
      const result = await axios(url)
        .then(({ data }) => {
          writeFile(`${__dirname}/data/users.json`, JSON.stringify(data), { encoding: 'utf8' })
          return data
        })
        .catch((err) => err)
      return result
    }) 
      
  res.json(users)
})

server.post('/api/v1/users', async (req, res) => {
  const userData = { ...req.body }

  const result = await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
    .then((text) => {
      const users = JSON.parse(text)
      const newId = users[users.length - 1].id + 1
      const usersUpdated = [ ...users, { id: newId, ...userData }]
      writeFile(`${__dirname}/data/users.json`, JSON.stringify(usersUpdated), { encoding: 'utf8' })
      return { status: 'success', id: newId }
    })
    .catch(async () => {
      const url = `https://jsonplaceholder.typicode.com/users`
      const status = await axios(url)
        .then(({ data: users }) => {
          const newId = users[users.length - 1].id + 1
          const usersUpdated = [ ...users, { id: newId, ...userData }]
          writeFile(`${__dirname}/data/users.json`, JSON.stringify(usersUpdated), { encoding: 'utf8' })
          return { status: 'success', id: newId }
        })
        .catch((err) => err)
      return status
    }) 
      
  res.json(result)
})
/*
server.get('/api/v1/users/:someParam', (req, res) => {
  const { someParam } = req.params
  console.log(req.params)
  res.json({ param: someParam })
})

*/
server.patch('/api/v1/users/:userId', async (req, res) => {
  const newData = req.body
  const { userId } = req.params
  await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
    .then((text) => {
      const users = JSON.parse(text)
      const updatedUserList = users.map((user) => {
        if (user.id === +userId) {
          return { ...user, ...newData }
        }
        return user
      })
  writeFile(`${__dirname}/data/users.json`, JSON.stringify(updatedUserList), { encoding: 'utf8' })
    })
    .catch((err) => {
      console.log(err)
    })  
  res.json({ status: 'success', id: userId })
  })

  server.delete('/api/v1/users/:userId', async (req, res) => {
   
    const { userId } = req.params
    await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' })
      .then((text) => {
        const users = JSON.parse(text)
        const updatedUserList = users.filter((user) => {
          return user.id !== +userId
           
        })
    writeFile(`${__dirname}/data/users.json`, JSON.stringify(updatedUserList), { encoding: 'utf8' })
      })
      .catch((err) => {
        console.log(err)
      })  
    res.json({ status: 'success', id: userId })
    })
// unlink(`${__dirname}/test.json`)  

server.delete('/api/v1/users' ,  (req, res) => {
   
  unlink(`${__dirname}/data/users.json`)
  res.json({ status: 'success' })
  })


server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
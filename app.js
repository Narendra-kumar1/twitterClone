const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
const filePath = path.join(__dirname, 'twitterClone.db')

app.use(express.json())
let db = null
const InitializeDb = async () => {
  try {
    db = await open({
      filename: filePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server is running')
    })
  } catch (e) {
    console.log(e)
  }
}
InitializeDb()

app.post('/register/', async (request, Response) => {
  const {username, password, name, gender} = request.body
  const query = `select * from user where username="${username}"`
  const queryRes = await db.get(query)

  if (queryRes !== undefined) {
    console.log(queryRes)
    Response.status(400)
    Response.send('User already exists')
  } else if (password.length < 6) {
    Response.status(400)
    Response.send('Password is too short')
  } else {
    const pass = await bcrypt.hash(password, 10)
    const query = `insert into user (name,username,password,gender) values('${name}','${username}','${pass}','${gender}')`
    const queryRes = await db.run(query)
    Response.status(200)
    Response.send('User created successfully')
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const query = `select * from user where username="${username}"`
  const queryRes = await db.get(query)

  if (queryRes === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const comp = await bcrypt.compare(password, queryRes.password)
    if (!comp) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.status(200)
      response.send({jwtToken: jwtToken})
    }
  }
})

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        // response.send(jwtToken)
        next()
      }
    })
  }
}

const combineLikes = List => {
  const obj = {likes: []}
  for (let i of List) {
    obj.likes.push(i.likes)
  }
  return obj
}
const combinereplies = List => {
  const obj = {replies: []}
  for (let i of List) {
    obj.replies.push(i)
  }
  return obj
}
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  console.log(request.username)
  const query1 = `select user_id from user where username="${request.username}"`
  const query1res = await db.get(query1)
  const query = `select user.username,tweet,N.date_time as dateTime from ((user as u inner join follower as f on u.user_id=f.follower_user_id) as T inner join tweet on tweet.user_id=T.following_user_id) as N inner join user on user.user_id=N.following_user_id  where N.follower_user_id=${query1res.user_id} order by N.date_time desc limit 4 offset 0`
  const queryres = await db.all(query)
  response.send(queryres)
})

app.get('/user/following/', authenticateToken, async (request, response) => {
  const query = `select name from (select following_user_id from user inner join follower on user_id=follower_user_id where username="${request.username}") as T inner join user on user.user_id =T.following_user_id`
  const queryres = await db.all(query)
  response.send(queryres)
})

app.get('/user/followers/', authenticateToken, async (request, response) => {
  const query = `select name from (select follower_user_id from user inner join follower on user_id=following_user_id where username="${request.username}") as T inner join user on user.user_id =T.follower_user_id`
  const queryres = await db.all(query)
  response.send(queryres)
})

app.get('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const query1 = `select user_id from tweet where tweet_id=${tweetId}`
  const query1res = await db.get(query1)
  let query2res = undefined
  if (query1res !== undefined) {
    const query2 = `select * from user inner join follower on user.user_id=follower.follower_user_id where following_user_id=${query1res.user_id} and username="${request.username}"`
    query2res = await db.get(query2)
  }
  if (query2res === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const query3 = `select tweet.tweet,count( distinct like_id) as likes,count(distinct reply_id)as replies,date_time as dateTime from ((tweet left join like on like.tweet_id=tweet.tweet_id )as T left join reply on reply.tweet_id=tweet.tweet_id ) as N where tweet.tweet_id=${tweetId}  group by N.tweet_id `
    // const query3=``
    const query3res = await db.get(query3)
    response.send(query3res)
  }
})

app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const query1 = `select user_id from tweet where tweet_id=${tweetId}`
    const query1res = await db.get(query1)
    let query2res = undefined
    if (query1res !== undefined) {
      const query2 = `select * from user inner join follower on user.user_id=follower.follower_user_id where following_user_id=${query1res.user_id} and username="${request.username}"`
      query2res = await db.get(query2)
    }
    if (query2res === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const query3 = `select username as likes from user inner join like on user.user_id=like.user_id where tweet_id=${tweetId}`
      const query3res = await db.all(query3)
      response.send(combineLikes(query3res))
    }
  },
)

app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {tweetId} = request.params
    const query1 = `select user_id from tweet where tweet_id=${tweetId}`
    const query1res = await db.get(query1)
    let query2res = undefined
    if (query1res !== undefined) {
      const query2 = `select * from user inner join follower on user.user_id=follower.follower_user_id where following_user_id=${query1res.user_id} and username="${request.username}"`
      query2res = await db.get(query2)
    }
    if (query2res === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const query3 = `select name,reply from user inner join reply on reply.user_id=user.user_id where tweet_id=${tweetId}`
      const query3res = await db.all(query3)
      response.send(combinereplies(query3res))
    }
  },
)

app.get('/user/tweets/', authenticateToken, async (request, response) => {
  //const query1 = `select  tweet.tweet as tweet,count(like_id) as likes,count(reply) as replies,tweet.date_time as date_time from (((user inner join tweet on user.user_id=tweet.user_id) as T left join reply on tweet.tweet_id=reply.tweet_id) as N left join like on tweet.tweet_id=like.tweet_id) where username="${request.username}" group by tweet.tweet_id`
  const query1 = `select tweet,count( distinct like_id) as likes ,count( distinct reply_id) as replies,tweet.date_time as dateTime from ((user inner join tweet on tweet.user_id=user.user_id) as T left join like on like.tweet_id=T.tweet_id)as N left join reply on reply.tweet_id=N.tweet_id where user.username="${request.username}" group by tweet.tweet_id `
  const query1res = await db.all(query1)
  response.send(query1res)
})

app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request
  const {tweet} = request.body
  const query = `select user_id from user where username="${username}"`
  const res = await db.get(query)
  const {user_id} = res
  const query1 = `insert into tweet (tweet,user_id) values("${tweet}",${user_id})`
  const q1res = await db.run(query1)
  response.send('Created a Tweet')
})

app.delete('/tweets/:tweetId', authenticateToken, async (request, response) => {
  const {tweetId} = request.params
  const query = `select user_id from user where username="${request.username}"`
  const queryres = await db.get(query)
  const query1 = `select * from tweet where tweet_id=${tweetId} and user_id=${queryres.user_id}`
  const query1res = await db.get(query1)
  if (query1res === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const query2 = `delete from tweet where tweet_id=${tweetId} and user_id=${queryres.user_id}`
    const query2res = await db.run(query2)
    response.send('Tweet Removed')
  }
})
module.exports = app

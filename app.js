"use strict"
var express = require("express")
var fs = require("fs")
var bodyParser = require("body-parser")
var app = express()

var cookieParser = require("cookie-parser")
var jsonParser = bodyParser.json()
var urlencodedParser = bodyParser.urlencoded({ extended: false })

var userdataFileName = __dirname + "/userdata.json"
var sessionsFileName = __dirname + "/sessions.json"

var time_before_logout = 30000

var timeouts = {}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function is_signed_in(req) {
  if (req.cookies.sid != undefined)
    if (getUsername(req.cookies.sid)) {
      return true
    }
  return false
}

function randomNumber() {
  return getRandomInt(0, 1000000)
}

function isRegistred(username) {
  var userdata = JSON.parse(fs.readFileSync(userdataFileName))
  return username in userdata
}

function addUser(username, password) {
  var userdata = JSON.parse(fs.readFileSync(userdataFileName))
  userdata[username] = password
  fs.writeFileSync(userdataFileName, JSON.stringify(userdata))
}

function getUserDict() {
  var userdata = JSON.parse(fs.readFileSync(userdataFileName))
  return userdata
}

function inform(title, msg, res) {
  var template = fs.readFileSync(__dirname + "/public/msg_template.html")
  template = template.toString()
  var result = template.replace("#{title}", title).replace("#{message}", msg)
  res.send(result)
}

function getUsername(sid) {
  sid = sid.toString()
  var sessiondata = JSON.parse(fs.readFileSync(sessionsFileName))
  return sessiondata[sid]
}

function putSession(sid, username) {
  sid = sid.toString()
  var sessiondata = JSON.parse(fs.readFileSync(sessionsFileName))
  sessiondata[sid] = username
  fs.writeFileSync(sessionsFileName, JSON.stringify(sessiondata))
}

function deleteSession(sid) {
  sid = sid.toString()
  var sessiondata = JSON.parse(fs.readFileSync(sessionsFileName))
  delete sessiondata[sid]
  fs.writeFileSync(sessionsFileName, JSON.stringify(sessiondata))
}

app.use(cookieParser())

app.get("/", function(req, res) {
  var fileName
  if (is_signed_in(req)) {
    fileName = "authorized.html"
    var text = fs.readFileSync(__dirname + "/public/authorized.html")
    text = text.toString()
    text = text.replace("#{username}", getUsername(req.cookies.sid))
    res.send(text)
    clearTimeout(timeouts[req.cookies.sid])
    var new_timeout = setTimeout(function() {
                        console.log("creating a new timeout")
                        console.log(getUsername(req.cookies.sid), "signed out")
                        deleteSession(req.cookies.sid)
                      }, time_before_logout)
    timeouts[req.cookies.sid] = new_timeout
  }
  else {
    res.sendFile("index.html", { root: __dirname + "/public" })
  }
})

app.post("/logout", function (req, res) {
  console.log("processing a logout request")
  console.log(getUsername(req.cookies.sid), "signed out")
  res.clearCookie("sid")
  deleteSession(req.cookies.sid)
  res.redirect("/")
})

app.post("/sign_in", urlencodedParser, function (req, res) {
  console.log("processing a sign_in request")
  var userdata = getUserDict()
  if (!isRegistred(req.body.username))
    inform("user doesn't exist", "A user with the name <b>"
                               + req.body.username
                               + "</b> does not exist.",
           res)
  if (req.body.password != userdata[req.body.username])
    inform("wrong password", "Sorry, the passwords do not match. Try again",
           res)
  else {
    var new_sid = randomNumber()
    res.cookie("sid", new_sid)
    putSession(new_sid, req.body.username)
    inform("logged in", "Hi, " + req.body.username
                      + ". You have successfully signed in.", res)
    var timeout = setTimeout(function() {
                    deleteSession(new_sid)
                    console.log(req.body.username, "signed out")
                  }, time_before_logout)
    timeouts[new_sid] = timeout
    console.log(req.body.username, "signed in")
  }
  res.end()
})

app.post("/sign_up", urlencodedParser, function (req, res) {
  if (isRegistred(req.body.username))
    inform("user already exists",
           "Sorry, a user with the name "
                                 + req.body.username
                                 + " already exists.",
           res)
  else if (req.body.password.length <= 4) {
    inform("password too short",
           "The password is not long enough. Try again",
           res)
  }
  else {
    addUser(req.body.username, req.body.password)
    inform("signed up", "You just signed up.", res)
    console.log(req.body.username, "signed up")
  }
  res.end()
})

app.get("/:filename", function (req, res, next) {
  if (is_signed_in(req)) {
    res.redirect("/")
    return
  }
  var fileName = req.params.filename
  res.sendFile(fileName,
               {root: __dirname + '/public/'},
               function (err) {
                 if (err) {
                   if (err.code === "ECONNABORT" && res.statusCode == 304) {
                     // No problem, 304 means client cache hit, so no data sent.
                     console.log('304 cache hit for ' + fileName);
                     return;
                   }
                   else res.status(err.status).end()
                 }
                 else {
                   console.log("file", fileName, "was sent")
                   res.end()
                 }
               })
})

app.listen(8000)

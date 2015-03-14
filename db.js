var AWS = require('aws-sdk')

// Because the AWS SDK works in the browser as well, we can share this file and all its
// functions and reuse them on both the server and the browser

var db = module.exports = new AWS.DynamoDB({
  // This endpoint will try to connect to a DynamoDB running locally
  // Comment this out if you want to connect to a live/production AWS DynamoDB instance
  endpoint: 'http://localhost:4567',
  region: 'us-east-1',
  // These credentials are only necessary if connecting to AWS,
  // but including credentials in your client-side code is obviously
  // problematic if your project is public facing.
  // See http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/browser-configuring.html#Loading_Credentials_in_the_Client_s_Browser
  // for other (safer) methods to authenticate users for the AWS SDK
  credentials: {accessKeyId: 'akid', secretAccessKey: 'secret'},
})

// This function will fetch the id, date and title of all posts in our
// "grumblr" table
db.getAllPosts = function(cb) {
  db.scan({TableName: 'grumblr', AttributesToGet: ['id', 'date', 'title']}, function(err, res) {
    if (err) return cb(err)
    cb(null, res.Items.map(fromDynamo).sort(function(post1, post2) {
      return post1.date.localeCompare(post2.date)
    }))
  })
}

// This function will fetch the detail of a particular posts from our "grumblr"
// table
db.getPost = function(id, cb) {
  db.getItem({TableName: 'grumblr', Key: {id: {S: id}}}, function(err, res) {
    if (err) return cb(err)
    if (!res.Item) return cb(new Error('NotFound'))
    cb(null, fromDynamo(res.Item))
  })
}

// A simple utility function to flatten a DynamoDB object
function fromDynamo(dynamoObj) {
  return Object.keys(dynamoObj).reduce(function(obj, key) {
    obj[key] = dynamoObj[key][Object.keys(dynamoObj[key])[0]]
    return obj
  }, {})
}

react-server-routing-example
----------------------------

A simple (no compile) example of how to do shared server/browser rendering,
routing and data fetching with [React](http://facebook.github.io/react/) and
[AWS DynamoDB](http://aws.amazon.com/dynamodb/) for fast page loads, and
search-engine-friendly progressively-enhanced pages.

Some call this isomorphic but I'd prefer to just call it "shared", because
really that's all it is – sharing as much browser and server code as possible
and allowing single-page apps to also render on the server. All React
components, as well as `routes.js` and `db.js` are shared (using
[browserify](http://browserify.org/)).

This example shows a *very* basic blog post viewer, Grumblr, with the posts
stored in and fetched from DynamoDB whenever the route changes.

An even simpler example of server-side rendering with React, with no routing or
data fetching, can be found at
[react-server-example](https://github.com/mhart/react-server-example).

Example
-------

```sh
$ npm install
$ node server.js
```

Then navigate to [http://localhost:3000](http://localhost:3000) and click some
links, press the back button, etc.

Try viewing the page source to ensure the HTML being sent from the server is
already rendered (with checksums to determine whether client-side rendering is
necessary).

Also note that when JavaScript is enabled, the single-page app will fetch the
data via AJAX POSTs to DynamoDB directly, but when it's disabled the links will
follow the hrefs and fetch the full page from the server each request.

Here are the files involved:

`routes.js`:
```js
var React = require('react'),
    db = require('./db')

// This is a very basic router, shared between the server (in server.js) and
// browser (in App.js), with each route defining the main component to be
// rendered and a data-fetching function to fetch the data each component will need

// A lookup table of all the components we need to route to
exports.components = {
  PostList: React.createFactory(require('./PostList')),
  PostView: React.createFactory(require('./PostView')),
}

// You would typically have more route matching capabilities in a real-world
// app, but this is a transparent way to illustrate the concept
exports.resolve = function(url) {

  if (url == '/') {

    return {
      componentName: 'PostList',
      fetchData: db.getAllPosts,
    }

  } else if (url.slice(0, 7) == '/posts/') {

    var id = url.split('/')[2]

    return {
      componentName: 'PostView',
      fetchData: db.getPost.bind(db, id),
    }

  }

}
```

`PostList.js`:
```js
var React = require('react'),
    DOM = React.DOM, div = DOM.div, h1 = DOM.h1, ul = DOM.ul, li = DOM.li, a = DOM.a

// This is the component we use for listing the posts on the homepage

module.exports = React.createClass({

  render: function() {

    return div(null,

      h1(null, 'Grumblr'),

      // props.data will be an array of posts
      ul({children: this.props.data.map(function(post) {

        // If the browser isn't JS-capable, then the links will work as per
        // usual, making requests to the server – otherwise they'll use the
        // client-side routing handler setup in the top-level App component
        return li(null, a({href: '/posts/' + post.id, onClick: this.props.onClick}, post.title))

      }.bind(this))})
    )
  }

})
```

`PostView.js`:
```js
var React = require('react'),
    DOM = React.DOM, div = DOM.div, h1 = DOM.h1, p = DOM.p, a = DOM.a

// This is the component we use for viewing an individual post

module.exports = React.createClass({

  render: function() {
    var post = this.props.data

    return div(null,

      h1(null, post.title),

      p(null, post.body),

      p(null, a({href: '/', onClick: this.props.onClick}, '< Grumblr Home'))
    )
  }

})
```

`App.js`:
```js
var React = require('react'),
    routes = require('./routes')

// This is the top-level component responsible for rendering the correct
// component (PostList/PostView) for the given route as well as handling any
// client-side routing needs (via window.history and window.onpopstate)

module.exports = React.createClass({

  // The props will be server-side rendered and passed in, so they'll be used
  // for the initial page load and render
  getInitialState: function() {
    return {componentName: this.props.componentName, data: this.props.data}
  },

  // When the component has been created in the browser, wire up
  // window.onpopstate to deal with URL updates
  componentDidMount: function() {
    window.onpopstate = this.updateUrl
  },

  // This click handler will be passed to all child components to attach to any
  // links so that all routing happens client-side after initial page load
  handleClick: function(e) {
    e.preventDefault()
    window.history.pushState(null, null, e.target.pathname)
    this.updateUrl()
  },

  // Whenever the url is updated in the browser, resolve the corresponding
  // route and call its data-fetching function, just as we do on the server
  // whenever a request comes in
  updateUrl: function() {
    var route = routes.resolve(document.location.pathname)
    if (!route) return window.alert('Not Found')

    route.fetchData(function(err, data) {
      if (err) return window.alert(err)

      // This will trigger a re-render with (potentially) a new component and data
      this.setState({componentName: route.componentName, data: data})

    }.bind(this))
  },

  // We look up the current route component via its name, and then render it
  // passing in the data we've fetched, and the click handler for routing
  render: function() {
    var component = routes.components[this.state.componentName]
    return component({data: this.state.data, onClick: this.handleClick})
  },

})
```

`browser.js`:
```js
var React = require('react'),
    App = React.createFactory(require('./App'))

// This script will run in the browser and will render our component using the
// value from APP_PROPS that we generate inline in the page's html on the server.
// If these props match what is used in the server render, React will see that
// it doesn't need to generate any DOM and the page will load faster

React.render(App(window.APP_PROPS), document.getElementById('content'))
```

`server.js`:
```js
var http = require('http'),
    browserify = require('browserify'),
    literalify = require('literalify'),
    React = require('react'),
    AWS = require('aws-sdk'),
    // Our routes, DB and React components are all shared by server and browser
    // thanks to browserify
    routes = require('./routes'),
    db = require('./db'),
    App = React.createFactory(require('./App')),
    DOM = React.DOM, body = DOM.body, div = DOM.div, script = DOM.script


// Just create a plain old HTTP server that responds to our route endpoints
// (and '/bundle.js')
var server = http.createServer(function(req, res) {

  // See if we have any component routes matching the requested URL
  var route = routes.resolve(req.url)

  if (route) {

    res.setHeader('Content-Type', 'text/html')

    // We have a matching route, so call its data-fetching function to get the
    // props/data we'll need to pass to the top-level component
    route.fetchData(function(err, data) {

      if (err) {
        res.statusCode = err.message == 'NotFound' ? 404 : 500
        return res.end(err.toString())
      }

      // Define the props for the top level React component – here we have the
      // name of the component we want to display for this route, as well as
      // any data we've fetched
      var props = {
        componentName: route.componentName,
        data: data,
      }

      // Here we're using React to render the outer body, so we just use the
      // simpler renderToStaticMarkup function, but you could use any templating
      // language (or just a string) for the outer page template
      var html = React.renderToStaticMarkup(body(null,

        // The actual server-side rendering of our component occurs here,
        // passing in `props`. This div is the same one that the client will
        // "render" into on the browser from browser.js
        div({id: 'content', dangerouslySetInnerHTML: {__html:
          React.renderToString(App(props))
        }}),

        // The props should match on the client and server, so we stringify them
        // on the page to be available for access by the code run in browser.js
        // You could use any var name here as long as it's unique
        script({dangerouslySetInnerHTML: {__html:
          'var APP_PROPS = ' + safeStringify(props) + ';'
        }}),

        // We'll load React and AWS from a CDN - you don't have to do this,
        // you can bundle them up or serve them locally if you like
        script({src: '//fb.me/react-0.13.0.min.js'}),
        script({src: '//sdk.amazonaws.com/js/aws-sdk-2.1.17.min.js'}),

        // Then the browser will fetch and run the browserified bundle consisting
        // of browser.js and all its dependencies.
        // We serve this from the endpoint a few lines down.
        script({src: '/bundle.js'})
      ))

      // Return the page to the browser
      res.end(html)
    })

  // This endpoint is hit when the browser is requesting bundle.js from the page above
  } else if (req.url == '/bundle.js') {

    res.setHeader('Content-Type', 'text/javascript')

    // Here we invoke browserify to package up browser.js and everything it requires.
    // DON'T do it on the fly like this in production - it's very costly -
    // either compile the bundle ahead of time, or use some smarter middleware
    // (eg browserify-middleware).
    // We also use literalify to transform our `require` statements for React
    // and AWS so that it uses the global variable (from the CDN JS file)
    // instead of bundling it up with everything else
    return browserify()
      .add('./browser.js')
      .transform(literalify.configure({
        'react': 'window.React',
        'aws-sdk': 'window.AWS',
      }))
      .bundle()
      .pipe(res)

  // Return 404 for all other requests
  } else {
    res.statusCode = 404
    return res.end('Not Found')
  }

})

// We start the http server on after we check if the DB has been setup correctly
ensureTableExists(function(err) {
  if (err) throw err
  server.listen(3000, function(err) {
    if (err) throw err
    console.log('Listening on 3000...')
  })
})


// A utility function to safely escape JSON for embedding in a <script> tag
function safeStringify(obj) {
  return JSON.stringify(obj).replace(/<\/script/g, '<\\/script').replace(/<!--/g, '<\\!--')
}


// A bootstrapping function to create and populate our DB table if it doesn't
// exist (and start the mock DB if running locally)
function ensureTableExists(cb) {
  // Excluded for brevity...
}
```

`db.js`:
```js
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
```

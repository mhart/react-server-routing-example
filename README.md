react-server-routing-example
----------------------------

A simple (no compile) example of how to do universal server/browser rendering,
routing and data fetching with [React](http://facebook.github.io/react/) and
[AWS DynamoDB](http://aws.amazon.com/dynamodb/) for fast page loads, and
search-engine-friendly progressively-enhanced pages.

Also known as isomorphic, this approach shares as much browser and server code
as possible and allows single-page apps to also render on the server. All
React components, as well as `router.js` and `db.js` are shared (using
[browserify](http://browserify.org/)) and data fetching needs are declared
statically on each component.

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

`router.js`:
```js
// This is a very basic router, shared between the server (in server.js) and
// browser (in App.js), with each route defining the URL to be matched and the
// main component to be rendered

exports.routes = {
  list: {
    url: '/',
    component: require('./PostList'),
  },
  view: {
    url: /^\/posts\/(\d+)$/,
    component: require('./PostView'),
  },
}

// A basic routing resolution function to go through each route and see if the
// given URL matches. If so we return the route key and data-fetching function
// the route's component has declared (if any)
exports.resolve = function(url) {
  for (var key in exports.routes) {
    var route = exports.routes[key]
    var match = typeof route.url == 'string' ? url == route.url : url.match(route.url)

    if (match) {
      var params = Array.isArray(match) ? match.slice(1) : []
      return {
        key: key,
        fetchData: function(cb) {
          if (!route.component.fetchData) return cb()
          return route.component.fetchData.apply(null, params.concat(cb))
        }
      }
    }
  }
}
```

`PostList.js`:
```js
var React = require('react'),
    db = require('./db'),
    DOM = React.DOM, div = DOM.div, h1 = DOM.h1, ul = DOM.ul, li = DOM.li, a = DOM.a

// This is the component we use for listing the posts on the homepage

module.exports = React.createClass({

  // Each component declares an asynchronous function to fetch its props.data
  statics: {
    fetchData: db.getAllPosts
  },

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
    db = require('./db'),
    DOM = React.DOM, div = DOM.div, h1 = DOM.h1, p = DOM.p, a = DOM.a

// This is the component we use for viewing an individual post

module.exports = React.createClass({

  // Will be called with the params from the route URL (the post ID)
  statics: {
    fetchData: db.getPost
  },

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
    router = require('./router')

// This is the top-level component responsible for rendering the correct
// component (PostList/PostView) for the given route as well as handling any
// client-side routing needs (via window.history and window.onpopstate)

module.exports = React.createClass({

  // The props will be server-side rendered and passed in, so they'll be used
  // for the initial page load and render
  getInitialState: function() {
    return this.props
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
    var route = router.resolve(document.location.pathname)
    if (!route) return window.alert('Not Found')

    route.fetchData(function(err, data) {
      if (err) return window.alert(err)

      // This will trigger a re-render with (potentially) a new component and data
      this.setState({routeKey: route.key, data: data})

    }.bind(this))
  },

  // We look up the current route via its key, and then render its component
  // passing in the data we've fetched, and the click handler for routing
  render: function() {
    return React.createElement(router.routes[this.state.routeKey].component,
      {data: this.state.data, onClick: this.handleClick})
  },

})
```

`browser.js`:
```js
var React = require('react'),
    ReactDOM = require('react-dom'),
    App = React.createFactory(require('./App'))

// This script will run in the browser and will render our component using the
// value from APP_PROPS that we generate inline in the page's html on the server.
// If these props match what is used in the server render, React will see that
// it doesn't need to generate any DOM and the page will load faster

ReactDOM.render(App(window.APP_PROPS), document.getElementById('content'))
```

`server.js`:
```js
var http = require('http'),
    browserify = require('browserify'),
    literalify = require('literalify'),
    React = require('react'),
    ReactDOMServer = require('react-dom/server'),
    AWS = require('aws-sdk'),
    // Our router, DB and React components are all shared by server and browser
    // thanks to browserify
    router = require('./router'),
    db = require('./db'),
    App = React.createFactory(require('./App')),
    DOM = React.DOM, body = DOM.body, div = DOM.div, script = DOM.script


// Just create a plain old HTTP server that responds to our route endpoints
// (and '/bundle.js')
var server = http.createServer(function(req, res) {

  // See if we have any component routes matching the requested URL
  var route = router.resolve(req.url)

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
      // key to lookup the component we want to display for this route, as well
      // as any data we've fetched
      var props = {
        routeKey: route.key,
        data: data,
      }

      // Here we're using React to render the outer body, so we just use the
      // simpler renderToStaticMarkup function, but you could use any templating
      // language (or just a string) for the outer page template
      var html = ReactDOMServer.renderToStaticMarkup(body(null,

        // The actual server-side rendering of our component occurs here,
        // passing in `props`. This div is the same one that the client will
        // "render" into on the browser from browser.js
        div({id: 'content', dangerouslySetInnerHTML: {__html:
          ReactDOMServer.renderToString(App(props))
        }}),

        // The props should match on the client and server, so we stringify them
        // on the page to be available for access by the code run in browser.js
        // You could use any var name here as long as it's unique
        script({dangerouslySetInnerHTML: {__html:
          'var APP_PROPS = ' + safeStringify(props) + ';'
        }}),

        // We'll load React and AWS from a CDN - you don't have to do this,
        // you can bundle them up or serve them locally if you like
        script({src: '//fb.me/react-0.14.7.min.js'}),
        script({src: '//fb.me/react-dom-0.14.7.min.js'}),
        script({src: '//sdk.amazonaws.com/js/aws-sdk-2.2.33.min.js'}),

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
        'react-dom': 'window.ReactDOM',
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

// We start the http server after we check if the DB has been setup correctly
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

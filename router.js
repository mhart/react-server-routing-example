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

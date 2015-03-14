var React = require('react'),
    db = require('./db')

// This is a very basic router, shared between the server and browser, with
// each route defining the main component to be rendered and a data-fetching
// function to fetch the data each component will need

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

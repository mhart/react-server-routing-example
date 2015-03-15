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

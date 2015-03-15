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

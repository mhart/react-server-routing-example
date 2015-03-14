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

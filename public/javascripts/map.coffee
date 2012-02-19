###
This script generates a Google map populated with events given to it by the
server.
  
It uses Backbone.js to separate concerns betwen models, views and controllers.
Models are RESTful wrappers around server-side objects persisted in the
database, and can POST back changes the user makes to his or her content.
###


# A top-level object for Memento code.
window.memento = {}


# Use Django-style HTML templating with Underscore.
_.templateSettings =
  interpolate: /\{\{(.+?)\}\}/g


# Inject the CSRF token for all Backbone AJAX requests.
Backbone.old_sync = Backbone.sync
Backbone.sync = (method, model, options) ->
  new_options =  _.extend({
    beforeSend: (xhr) ->
      token = $('meta[name="csrf-token"]').attr('content')
      if (token)
        xhr.setRequestHeader('X-CSRF-Token', token)
  }, options)
  Backbone.old_sync(method, model, new_options)


# Models

class GeographicEvent extends Backbone.Model
  escapedJson: ->
    return json =
      title: @escape "title"
      author: @escape "author"
      date: @getDate()
      place: @escape "place"
      description: @escape "description"
      id: @get "id"

  toJSON: ->
    return json =
      title: @get "title"
      author: @get "author"
      date: @getDate()
      place: @get "place"
      description: @get "description"
      id: @get "id"

  getSafe: (fieldName) ->
    # Strip a field of its HTML content and return.
    tmp = document.createElement "DIV"
    tmp.innerHTML = @get fieldName
    return tmp.textContent or tmp.innerText

  getDate: ->
    # Get this model's date as a JavaScript Date object.
    new Date(Date.parse(@get("date")))


class GeographicEventList extends Backbone.Collection
  model: GeographicEvent

  getGeographicEventsDuring: (year, month) ->
    if year is "Any"
      return @models
    @filter (geographicEvent) ->
      eventDate = geographicEvent.getDate()
      eventMonth = eventDate.getMonth().toString()
      eventYear = eventDate.getFullYear().toString()
      isMatch = false

      if year == 'Any'
        isMatch = true
      else
        isMatch = eventYear is year
        isMatch = if month == 'Any' then isMatch else isMatch and eventMonth is month

      return isMatch

class Map extends Backbone.Model
  initialize: (options) ->
    @url = "/maps/" + options.mapId
    # A GeographicEventList that shadows the raw JSON in @geographicEvents, an array
    # of GeographicEvent objects related to this Map.
    @__geographicEvents.url = "/geographic_events/"

  set: (attributes) ->
    super attributes
    if attributes.geographic_events?
      # Refresh the GeographicEventList (@__geographicEvents) with new JSON.
      if not @__geographicEvents
        @__geographicEvents = new GeographicEventList()
      @__geographicEvents.refresh @attributes.geographic_events

  get: (attribute) ->
    if attribute is "geographic_events"
      # Return the GeographicEventList instead of the JSON in @geographicEvents.
      return @__geographicEvents
    super attribute


# Views

class MarkerView extends Backbone.View
  template: _.template """
    <div class='marker-content'>
      <div class='marker-header'>
        <span class='title'>{{ title }}</span>
        <span class='meta'>{{ date.getMonth() }}/{{ date.getFullYear() }}. Added by {{ author }}.</span>
      </div>
      <div class='marker-place'><emphasis>{{ place }}</emphasis></div>
      <div class='marker-description'>{{ description }}</div>
      <a class='edit-marker' name='edit-marker' href='#markers/marker/edit/{{ id }}'>Edit</a>
    </div>
    """

  editTemplate: _.template """
    <div class='marker-edit-form'>
      <form id='marker-edit'>
      <input id='title' name='title' type='text' value='{{ title }}' placeholder='Title'>
      <input id='place' name='place' type='text' value='{{ place }}' placeholder='Place'>
      <textarea id='description-{{ id }}' name='description' rows=25 cols=45 placeholder='Description'>
        {{ description }}
      </textarea>
      <a class='save-button' name='save-button' href='#markers/marker/save/{{ id }}'>Save</a>
      <a class='cancel-button' name='cancel-button' href='#markers/marker/cancel/{{ id }}'>Cancel</a>
    </div>
    """

  # Actions that URLs are allowed to trigger.
  validActions: ['open', 'close', 'save', 'edit', 'cancel', 'toggle']

  initialize: -> 
    @map = @options.map
    @infoWindow = @options.infoWindow
    @maxWidth = 350
    @zoomLevel = 12
    @editButton = null
    @editing = null
    @ckeditor = null
    now = new Date()
    date = @model.getDate()
    position = new google.maps.LatLng(parseFloat(@model.get("lat")),
                      parseFloat(@model.get("lon")))

    # Create a new Google Maps marker for this geographicEvent.
    @marker = new google.maps.Marker
      position: position
      map: @map
      zIndex: @zIndexByAge

    # Age in days. TODO: Used?
    @marker.age = (now.getTime() - date.getTime()) / 86400000

    # Show this marker's content when the user clicks its icon.
    # TODO: Appview listens for event and does this?
    google.maps.event.addListener @marker, "click", => @open()
    
    # Render the marker whenever the model changes.
    @model.bind 'change', @render

    _.bindAll @, "render", "edit", "open", "close", "save", "toggle",
          "remove", "openInfoWindow", "readOnlyHtml", "editFormHtml",
          "handleAction"

  openInfoWindow: (content) ->
    maxWidth = @maxWidth
    height = null
    if @editing or /\<img/.test content
      maxWidth = null

    # Google's API requires .close() to set new max-width.
    @infoWindow.close()
    @infoWindow.setOptions
      maxWidth: maxWidth
    @infoWindow.setContent content
    @infoWindow.open @map, @marker

    # When editing a form, add a CKeditor widget; otherwise destroy widget.
    clear = =>
      @clearEditor()
      @clearInfoWindowEvents()

    if @editing
      # Attach a WYSIWYG editor when the infoWidnow opens.
      google.maps.event.addListener @infoWindow, 'domready', => @addEditor()
    else
      # Clear any lingering events. TODO: should happen when window closes.
      clear()

    google.maps.event.addListener @infoWindow, 'closeclick', -> clear()
    google.maps.event.addListener @infoWindow, 'content_changed', -> clear()

  addEditor: ->
    console.log "adding editor...", @ckeditor
    if not @ckeditor?
      @ckeditor = CKEDITOR.replace 'description-' + @model.get("id"),
        toolbar: [['Source', '-', 'Bold', 'Italic', 'Image', 'Link', 'Unlink']]

  clearEditor: ->
    if @ckeditor?
      CKEDITOR.remove @ckeditor
      @ckeditor = null

  clearInfoWindowEvents: ->
    google.maps.event.clearListeners @infoWindow, 'domready'
    google.maps.event.clearListeners @infoWindow, 'content_changed'
    google.maps.event.clearListeners @infoWindow, 'closeclick'

  readOnlyHtml: ->
    # Replace the marker's infoWindow with read-only HTML.
    return @template @model.toJSON()

  editFormHtml: ->
    # Replace the marker's infoWindow with an edit form.
    return @editTemplate @model.escapedJson()

  handleAction: (action) ->
    # Handle an action routed from the controller if the action is valid.
    if typeof @[action] is 'function' and _.indexOf @validActions, action isnt -1
      @[action]()

  # ACTIONS
   
  open: ->
    # Pan to the marker
    @map.panTo @marker.getPosition()
    if @map.getZoom() < @zoomLevel
      @map.setZoom @zoomLevel
    @editing = false
    @openInfoWindow @readOnlyHtml()

  edit: ->
    @toggle()

  cancel: ->
    @toggle()

  close: ->
    console.log "Debug: Info window closed"

  toggle: ->
    content = null
    # If the marker has never been opened, redirect and open.
    if not @editing?
      window.location = "#markers/marker/open/" + @model.get("id")
      return
    if @editing
      content = @readOnlyHtml()
      @editing = false
    else
      content = @editFormHtml()
      @editing = true

    $(@el).html content
    @openInfoWindow content

  save: ->
    # This won't work if we aren't on an edit form.
    if not @editing?
      return
    title = $("#title").val()
    place = $("#place").val()
    description = @ckeditor.getData()
    @model.set
      title: title,
      place: place,
      description: description
    @model.save()
    @toggle()

    # Redirect to the info window for this marker.
    window.location = "#markers/marker/open/" + @model.get("id")

  remove: ->
    # Unregister marker events
    google.maps.event.clearInstanceListeners @marker
    # Set map to null, causing marker to be removed per API spec
    @marker.setMap(null)

class NavigationItemView extends Backbone.View
  template: _.template """
    <li>
      <h3><a href='#markers/marker/open/{{ id }}'>{{ title }}</a></h4>
      <p>{{ description }}</p>
    </li>
    """

  initialize: ->
    _.bindAll @, 'render'
    @model.bind 'change', @render

  # Add item to list of markers in sidebar
  render: ->
    maxDescLength = 150
    sliceEnd = maxDescLength
    date = @model.getDate()
    markerYear = date.getFullYear() # unused
    navigation = $("#navigation-items")
    description = @model.getSafe "description"
    shortDescription = ""

    # First remove it if it already exists
    if @item?
      @remove()

    # Portion of the description to show in the navigation item.
    if description.length <= maxDescLength
      shortDescription = description
    else
      shortDescription = description.slice(0, maxDescLength) + " ..."

    @item = @template
      "title": @model.get "title"
      "id": @model.get "id"
      "description": shortDescription
    @item = $(@item).appendTo navigation

  remove: ->
    $(@item).remove()

class NavigationView extends Backbone.View
  initialize: ->
    _.bindAll @, 'render', 'addGeographicEvent', 'addGeographicEventsDuring', 'remove'

    @itemViews= []
    @yearSelectId = @options.yearSelectId || "year"
    @monthSelectId = @options.monthSelectId || "month"
    @year = @getSelectedYear()
    @id = @id || "navigation"

    @collection.bind 'add', @addGeographicEvent
    @collection.bind 'refresh', @render

    @renderTimeControl()
    @render()

  addGeographicEvent: (geographicEvent) ->
    view = new NavigationItemView
      model: geographicEvent
    @itemViews.push view

  addGeographicEventsDuring: (year, month) ->
    geographicEvents = @collection.getGeographicEventsDuring year, month
    $.each geographicEvents, (_, geographicEvent) =>
      @addGeographicEvent geographicEvent

  render: ->
    # Remove elements if they already exist.  
    @removeAll()

    # Add subviews for all visible models.
    @addGeographicEventsDuring @year, @month
  
    # Render all subviews
    $.each @itemViews, -> @render()

  renderTimeControl: ->
    yearSelect = $("#"+@yearSelectId)
    monthSelect = $("#"+@monthSelectId)

    yearSelect.change =>
      @timeControlChanged()

    monthSelect.change =>
      @timeControlChanged()

  removeAll: ->
    if @itemViews
      # Rmove all subviews
      $.each @itemViews, -> @remove()
      @itemViews = []

  getSelectedOption: (id) ->
    option = $("#"+id).children("option:selected")
    return option.val()

  getSelectedYear: ->
    return @getSelectedOption(@yearSelectId)

  getSelectedMonth: ->
    return @getSelectedOption(@monthSelectId)

  timeControlChanged: ->
    year = @getSelectedYear()
    month = @getSelectedMonth()

    # Notify watchers of the current date range and render subviews.
    @year = year
    @month = month
    @render()
    @trigger "nav:timeControlChanged"


class AppView extends Backbone.View

  # In this class, 'model' is a Map that contains GeographicEvent objects
  # serialized to JSON.
  initialize: ->
    _.bindAll @, "addGeographicEventsDuring", "addGeographicEvent", "render", "remove", "filterMarkers"
  
    @googleMap = null
    @markerViews = []
    @navigationView = new NavigationView
      collection: @model.get('geographic_events')

    # TODO: User chooses default center, or default to their location.
    portlandOregon = new google.maps.LatLng(45.52, -122.68)

    defaults =
      mapId: "map"
      infoWindowMaxWidth: 350
      center: portlandOregon
      mapTypeId: google.maps.MapTypeId.TERRAIN
      defaultZoomLevel: 10

    @options = $.extend defaults, @options
    @googleMap = @initGoogleMap()
    @infoWindow = @initInfoWindow()

    # Bind events to methods.
    @navigationView.bind "nav:timeControlChanged", @filterMarkers
    @model.get('geographic_events').bind "refresh", @filterMarkers
    @model.get('geographic_events').bind "add", @addGeographicEvent
    @filterMarkers()

  sendActionToMarker: (action, id) ->
    id = parseInt(id)
    markers = _.select @markerViews, (view) -> view.model.get("id") is id
    markers[0].handleAction(action) if markers[0]

  initGoogleMap: ->
    mapOptions =
      zoom: @options.defaultZoomLevel
      center: @options.center
      mapTypeId: @options.mapTypeId
      panControlOptions:
        position: google.maps.ControlPosition.RIGHT_TOP
      zoomControlOptions:
        position: google.maps.ControlPosition.RIGHT_TOP

    mapEl = document.getElementById @options.mapId
    return new google.maps.Map mapEl, mapOptions

  initInfoWindow: ->
    infoWindow = new google.maps.InfoWindow
      maxWidth: @options.infoWindowMaxWidth

  render: (year, month) ->
    @removeAll()
    @addGeographicEventsDuring year, month

    # Pan map to the most recent geographicEvent on the map 
    latestGeographicEvent = @markerViews[@markerViews.length-1]

    if latestGeographicEvent isnt undefined
      @googleMap.panTo latestGeographicEvent.marker.getPosition()
    else
      # TODO: Handle the case where no markers are visible. 

  # Remove all markers and add any that match the selected year and month.
  filterMarkers: ->
    @render @navigationView.getSelectedYear(), @navigationView.getSelectedMonth()

  addGeographicEvent: (geographicEvent) ->
    @markerViews.push new MarkerView
      model: geographicEvent
      map: @googleMap
      infoWindow: @infoWindow

  addGeographicEventsDuring: (year, month) ->
    geographicEvents = @model.get('geographic_events').getGeographicEventsDuring year, month
    $.each geographicEvents, (_, geographicEvent) => @addGeographicEvent geographicEvent

  removeAll: ->
    @infoWindow.close()
    $.each @markerViews, -> @remove()


class HomeController extends Backbone.Controller
  routes:
    "markers/marker/:action/:id": "sendActionToMarker"

  initialize: (options) ->
    @appView = new AppView
      model: options.map

    _.bindAll @, "sendActionToMarker"

  sendActionToMarker: (action, id) ->
    @appView.sendActionToMarker action, id
  
window.memento.HomeController = HomeController
window.memento.GeographicEventList = GeographicEventList
window.memento.Map = Map

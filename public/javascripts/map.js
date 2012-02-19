(function() {
  /*
  This script generates a Google map populated with events given to it by the
  server.
    
  It uses Backbone.js to separate concerns betwen models, views and controllers.
  Models are RESTful wrappers around server-side objects persisted in the
  database, and can POST back changes the user makes to his or her content.
  */
  var AppView, GeographicEvent, GeographicEventList, HomeController, Map, MarkerView, NavigationItemView, NavigationView;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  window.memento = {};
  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };
  Backbone.old_sync = Backbone.sync;
  Backbone.sync = function(method, model, options) {
    var new_options;
    new_options = _.extend({
      beforeSend: function(xhr) {
        var token;
        token = $('meta[name="csrf-token"]').attr('content');
        if (token) {
          return xhr.setRequestHeader('X-CSRF-Token', token);
        }
      }
    }, options);
    return Backbone.old_sync(method, model, new_options);
  };
  GeographicEvent = (function() {
    __extends(GeographicEvent, Backbone.Model);
    function GeographicEvent() {
      GeographicEvent.__super__.constructor.apply(this, arguments);
    }
    GeographicEvent.prototype.escapedJson = function() {
      var json;
      return json = {
        title: this.escape("title"),
        author: this.escape("author"),
        date: this.getDate(),
        place: this.escape("place"),
        description: this.escape("description"),
        id: this.get("id")
      };
    };
    GeographicEvent.prototype.toJSON = function() {
      var json;
      return json = {
        title: this.get("title"),
        author: this.get("author"),
        date: this.getDate(),
        place: this.get("place"),
        description: this.get("description"),
        id: this.get("id")
      };
    };
    GeographicEvent.prototype.getSafe = function(fieldName) {
      var tmp;
      tmp = document.createElement("DIV");
      tmp.innerHTML = this.get(fieldName);
      return tmp.textContent || tmp.innerText;
    };
    GeographicEvent.prototype.getDate = function() {
      return new Date(Date.parse(this.get("date")));
    };
    return GeographicEvent;
  })();
  GeographicEventList = (function() {
    __extends(GeographicEventList, Backbone.Collection);
    function GeographicEventList() {
      GeographicEventList.__super__.constructor.apply(this, arguments);
    }
    GeographicEventList.prototype.model = GeographicEvent;
    GeographicEventList.prototype.getGeographicEventsDuring = function(year, month) {
      if (year === "Any") {
        return this.models;
      }
      return this.filter(function(geographicEvent) {
        var eventDate, eventMonth, eventYear, isMatch;
        eventDate = geographicEvent.getDate();
        eventMonth = eventDate.getMonth().toString();
        eventYear = eventDate.getFullYear().toString();
        isMatch = false;
        if (year === 'Any') {
          isMatch = true;
        } else {
          isMatch = eventYear === year;
          isMatch = month === 'Any' ? isMatch : isMatch && eventMonth === month;
        }
        return isMatch;
      });
    };
    return GeographicEventList;
  })();
  Map = (function() {
    __extends(Map, Backbone.Model);
    function Map() {
      Map.__super__.constructor.apply(this, arguments);
    }
    Map.prototype.initialize = function(options) {
      this.url = "/maps/" + options.mapId;
      return this.__geographicEvents.url = "/geographic_events/";
    };
    Map.prototype.set = function(attributes) {
      Map.__super__.set.call(this, attributes);
      if (attributes.geographic_events != null) {
        if (!this.__geographicEvents) {
          this.__geographicEvents = new GeographicEventList();
        }
        return this.__geographicEvents.refresh(this.attributes.geographic_events);
      }
    };
    Map.prototype.get = function(attribute) {
      if (attribute === "geographic_events") {
        return this.__geographicEvents;
      }
      return Map.__super__.get.call(this, attribute);
    };
    return Map;
  })();
  MarkerView = (function() {
    __extends(MarkerView, Backbone.View);
    function MarkerView() {
      MarkerView.__super__.constructor.apply(this, arguments);
    }
    MarkerView.prototype.template = _.template("<div class='marker-content'>\n  <div class='marker-header'>\n    <span class='title'>{{ title }}</span>\n    <span class='meta'>{{ date.getMonth() }}/{{ date.getFullYear() }}. Added by {{ author }}.</span>\n  </div>\n  <div class='marker-place'><emphasis>{{ place }}</emphasis></div>\n  <div class='marker-description'>{{ description }}</div>\n  <a class='edit-marker' name='edit-marker' href='#markers/marker/edit/{{ id }}'>Edit</a>\n</div>");
    MarkerView.prototype.editTemplate = _.template("<div class='marker-edit-form'>\n  <form id='marker-edit'>\n  <input id='title' name='title' type='text' value='{{ title }}' placeholder='Title'>\n  <input id='place' name='place' type='text' value='{{ place }}' placeholder='Place'>\n  <textarea id='description-{{ id }}' name='description' rows=25 cols=45 placeholder='Description'>\n    {{ description }}\n  </textarea>\n  <a class='save-button' name='save-button' href='#markers/marker/save/{{ id }}'>Save</a>\n  <a class='cancel-button' name='cancel-button' href='#markers/marker/cancel/{{ id }}'>Cancel</a>\n</div>");
    MarkerView.prototype.validActions = ['open', 'close', 'save', 'edit', 'cancel', 'toggle'];
    MarkerView.prototype.initialize = function() {
      var date, now, position;
      this.map = this.options.map;
      this.infoWindow = this.options.infoWindow;
      this.maxWidth = 350;
      this.zoomLevel = 12;
      this.editButton = null;
      this.editing = null;
      this.ckeditor = null;
      now = new Date();
      date = this.model.getDate();
      position = new google.maps.LatLng(parseFloat(this.model.get("lat")), parseFloat(this.model.get("lon")));
      this.marker = new google.maps.Marker({
        position: position,
        map: this.map,
        zIndex: this.zIndexByAge
      });
      this.marker.age = (now.getTime() - date.getTime()) / 86400000;
      google.maps.event.addListener(this.marker, "click", __bind(function() {
        return this.open();
      }, this));
      this.model.bind('change', this.render);
      return _.bindAll(this, "render", "edit", "open", "close", "save", "toggle", "remove", "openInfoWindow", "readOnlyHtml", "editFormHtml", "handleAction");
    };
    MarkerView.prototype.openInfoWindow = function(content) {
      var clear, height, maxWidth;
      maxWidth = this.maxWidth;
      height = null;
      if (this.editing || /\<img/.test(content)) {
        maxWidth = null;
      }
      this.infoWindow.close();
      this.infoWindow.setOptions({
        maxWidth: maxWidth
      });
      this.infoWindow.setContent(content);
      this.infoWindow.open(this.map, this.marker);
      clear = __bind(function() {
        this.clearEditor();
        return this.clearInfoWindowEvents();
      }, this);
      if (this.editing) {
        google.maps.event.addListener(this.infoWindow, 'domready', __bind(function() {
          return this.addEditor();
        }, this));
      } else {
        clear();
      }
      google.maps.event.addListener(this.infoWindow, 'closeclick', function() {
        return clear();
      });
      return google.maps.event.addListener(this.infoWindow, 'content_changed', function() {
        return clear();
      });
    };
    MarkerView.prototype.addEditor = function() {
      console.log("adding editor...", this.ckeditor);
      if (!(this.ckeditor != null)) {
        return this.ckeditor = CKEDITOR.replace('description-' + this.model.get("id"), {
          toolbar: [['Source', '-', 'Bold', 'Italic', 'Image', 'Link', 'Unlink']]
        });
      }
    };
    MarkerView.prototype.clearEditor = function() {
      if (this.ckeditor != null) {
        CKEDITOR.remove(this.ckeditor);
        return this.ckeditor = null;
      }
    };
    MarkerView.prototype.clearInfoWindowEvents = function() {
      google.maps.event.clearListeners(this.infoWindow, 'domready');
      google.maps.event.clearListeners(this.infoWindow, 'content_changed');
      return google.maps.event.clearListeners(this.infoWindow, 'closeclick');
    };
    MarkerView.prototype.readOnlyHtml = function() {
      return this.template(this.model.toJSON());
    };
    MarkerView.prototype.editFormHtml = function() {
      return this.editTemplate(this.model.escapedJson());
    };
    MarkerView.prototype.handleAction = function(action) {
      if (typeof this[action] === 'function' && _.indexOf(this.validActions, action !== -1)) {
        return this[action]();
      }
    };
    MarkerView.prototype.open = function() {
      this.map.panTo(this.marker.getPosition());
      if (this.map.getZoom() < this.zoomLevel) {
        this.map.setZoom(this.zoomLevel);
      }
      this.editing = false;
      return this.openInfoWindow(this.readOnlyHtml());
    };
    MarkerView.prototype.edit = function() {
      return this.toggle();
    };
    MarkerView.prototype.cancel = function() {
      return this.toggle();
    };
    MarkerView.prototype.close = function() {
      return console.log("Debug: Info window closed");
    };
    MarkerView.prototype.toggle = function() {
      var content;
      content = null;
      if (!(this.editing != null)) {
        window.location = "#markers/marker/open/" + this.model.get("id");
        return;
      }
      if (this.editing) {
        content = this.readOnlyHtml();
        this.editing = false;
      } else {
        content = this.editFormHtml();
        this.editing = true;
      }
      $(this.el).html(content);
      return this.openInfoWindow(content);
    };
    MarkerView.prototype.save = function() {
      var description, place, title;
      if (!(this.editing != null)) {
        return;
      }
      title = $("#title").val();
      place = $("#place").val();
      description = this.ckeditor.getData();
      this.model.set({
        title: title,
        place: place,
        description: description
      });
      this.model.save();
      this.toggle();
      return window.location = "#markers/marker/open/" + this.model.get("id");
    };
    MarkerView.prototype.remove = function() {
      google.maps.event.clearInstanceListeners(this.marker);
      return this.marker.setMap(null);
    };
    return MarkerView;
  })();
  NavigationItemView = (function() {
    __extends(NavigationItemView, Backbone.View);
    function NavigationItemView() {
      NavigationItemView.__super__.constructor.apply(this, arguments);
    }
    NavigationItemView.prototype.template = _.template("<li>\n  <h3><a href='#markers/marker/open/{{ id }}'>{{ title }}</a></h4>\n  <p>{{ description }}</p>\n</li>");
    NavigationItemView.prototype.initialize = function() {
      _.bindAll(this, 'render');
      return this.model.bind('change', this.render);
    };
    NavigationItemView.prototype.render = function() {
      var date, description, markerYear, maxDescLength, navigation, shortDescription, sliceEnd;
      maxDescLength = 150;
      sliceEnd = maxDescLength;
      date = this.model.getDate();
      markerYear = date.getFullYear();
      navigation = $("#navigation-items");
      description = this.model.getSafe("description");
      shortDescription = "";
      if (this.item != null) {
        this.remove();
      }
      if (description.length <= maxDescLength) {
        shortDescription = description;
      } else {
        shortDescription = description.slice(0, maxDescLength) + " ...";
      }
      this.item = this.template({
        "title": this.model.get("title"),
        "id": this.model.get("id"),
        "description": shortDescription
      });
      return this.item = $(this.item).appendTo(navigation);
    };
    NavigationItemView.prototype.remove = function() {
      return $(this.item).remove();
    };
    return NavigationItemView;
  })();
  NavigationView = (function() {
    __extends(NavigationView, Backbone.View);
    function NavigationView() {
      NavigationView.__super__.constructor.apply(this, arguments);
    }
    NavigationView.prototype.initialize = function() {
      _.bindAll(this, 'render', 'addGeographicEvent', 'addGeographicEventsDuring', 'remove');
      this.itemViews = [];
      this.yearSelectId = this.options.yearSelectId || "year";
      this.monthSelectId = this.options.monthSelectId || "month";
      this.year = this.getSelectedYear();
      this.id = this.id || "navigation";
      this.collection.bind('add', this.addGeographicEvent);
      this.collection.bind('refresh', this.render);
      this.renderTimeControl();
      return this.render();
    };
    NavigationView.prototype.addGeographicEvent = function(geographicEvent) {
      var view;
      view = new NavigationItemView({
        model: geographicEvent
      });
      return this.itemViews.push(view);
    };
    NavigationView.prototype.addGeographicEventsDuring = function(year, month) {
      var geographicEvents;
      geographicEvents = this.collection.getGeographicEventsDuring(year, month);
      return $.each(geographicEvents, __bind(function(_, geographicEvent) {
        return this.addGeographicEvent(geographicEvent);
      }, this));
    };
    NavigationView.prototype.render = function() {
      this.removeAll();
      this.addGeographicEventsDuring(this.year, this.month);
      return $.each(this.itemViews, function() {
        return this.render();
      });
    };
    NavigationView.prototype.renderTimeControl = function() {
      var monthSelect, yearSelect;
      yearSelect = $("#" + this.yearSelectId);
      monthSelect = $("#" + this.monthSelectId);
      yearSelect.change(__bind(function() {
        return this.timeControlChanged();
      }, this));
      return monthSelect.change(__bind(function() {
        return this.timeControlChanged();
      }, this));
    };
    NavigationView.prototype.removeAll = function() {
      if (this.itemViews) {
        $.each(this.itemViews, function() {
          return this.remove();
        });
        return this.itemViews = [];
      }
    };
    NavigationView.prototype.getSelectedOption = function(id) {
      var option;
      option = $("#" + id).children("option:selected");
      return option.val();
    };
    NavigationView.prototype.getSelectedYear = function() {
      return this.getSelectedOption(this.yearSelectId);
    };
    NavigationView.prototype.getSelectedMonth = function() {
      return this.getSelectedOption(this.monthSelectId);
    };
    NavigationView.prototype.timeControlChanged = function() {
      var month, year;
      year = this.getSelectedYear();
      month = this.getSelectedMonth();
      this.year = year;
      this.month = month;
      this.render();
      return this.trigger("nav:timeControlChanged");
    };
    return NavigationView;
  })();
  AppView = (function() {
    __extends(AppView, Backbone.View);
    function AppView() {
      AppView.__super__.constructor.apply(this, arguments);
    }
    AppView.prototype.initialize = function() {
      var defaults, portlandOregon;
      _.bindAll(this, "addGeographicEventsDuring", "addGeographicEvent", "render", "remove", "filterMarkers");
      this.googleMap = null;
      this.markerViews = [];
      this.navigationView = new NavigationView({
        collection: this.model.get('geographic_events')
      });
      portlandOregon = new google.maps.LatLng(45.52, -122.68);
      defaults = {
        mapId: "map",
        infoWindowMaxWidth: 350,
        center: portlandOregon,
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        defaultZoomLevel: 10
      };
      this.options = $.extend(defaults, this.options);
      this.googleMap = this.initGoogleMap();
      this.infoWindow = this.initInfoWindow();
      this.navigationView.bind("nav:timeControlChanged", this.filterMarkers);
      this.model.get('geographic_events').bind("refresh", this.filterMarkers);
      this.model.get('geographic_events').bind("add", this.addGeographicEvent);
      return this.filterMarkers();
    };
    AppView.prototype.sendActionToMarker = function(action, id) {
      var markers;
      id = parseInt(id);
      markers = _.select(this.markerViews, function(view) {
        return view.model.get("id") === id;
      });
      if (markers[0]) {
        return markers[0].handleAction(action);
      }
    };
    AppView.prototype.initGoogleMap = function() {
      var mapEl, mapOptions;
      mapOptions = {
        zoom: this.options.defaultZoomLevel,
        center: this.options.center,
        mapTypeId: this.options.mapTypeId,
        panControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP
        },
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP
        }
      };
      mapEl = document.getElementById(this.options.mapId);
      return new google.maps.Map(mapEl, mapOptions);
    };
    AppView.prototype.initInfoWindow = function() {
      var infoWindow;
      return infoWindow = new google.maps.InfoWindow({
        maxWidth: this.options.infoWindowMaxWidth
      });
    };
    AppView.prototype.render = function(year, month) {
      var latestGeographicEvent;
      this.removeAll();
      this.addGeographicEventsDuring(year, month);
      latestGeographicEvent = this.markerViews[this.markerViews.length - 1];
      if (latestGeographicEvent !== void 0) {
        return this.googleMap.panTo(latestGeographicEvent.marker.getPosition());
      } else {

      }
    };
    AppView.prototype.filterMarkers = function() {
      return this.render(this.navigationView.getSelectedYear(), this.navigationView.getSelectedMonth());
    };
    AppView.prototype.addGeographicEvent = function(geographicEvent) {
      return this.markerViews.push(new MarkerView({
        model: geographicEvent,
        map: this.googleMap,
        infoWindow: this.infoWindow
      }));
    };
    AppView.prototype.addGeographicEventsDuring = function(year, month) {
      var geographicEvents;
      geographicEvents = this.model.get('geographic_events').getGeographicEventsDuring(year, month);
      return $.each(geographicEvents, __bind(function(_, geographicEvent) {
        return this.addGeographicEvent(geographicEvent);
      }, this));
    };
    AppView.prototype.removeAll = function() {
      this.infoWindow.close();
      return $.each(this.markerViews, function() {
        return this.remove();
      });
    };
    return AppView;
  })();
  HomeController = (function() {
    __extends(HomeController, Backbone.Controller);
    function HomeController() {
      HomeController.__super__.constructor.apply(this, arguments);
    }
    HomeController.prototype.routes = {
      "markers/marker/:action/:id": "sendActionToMarker"
    };
    HomeController.prototype.initialize = function(options) {
      this.appView = new AppView({
        model: options.map
      });
      return _.bindAll(this, "sendActionToMarker");
    };
    HomeController.prototype.sendActionToMarker = function(action, id) {
      return this.appView.sendActionToMarker(action, id);
    };
    return HomeController;
  })();
  window.memento.HomeController = HomeController;
  window.memento.GeographicEventList = GeographicEventList;
  window.memento.Map = Map;
}).call(this);

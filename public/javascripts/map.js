(function() {
  /*
  This script generates a Google map populated with events given to it by the
  server.
      
  It uses Backbone.js to separate concerns betwen models, views and controllers.
  Models are RESTful wrappers around server-side objects persisted in the
  database, and can POST back changes the user makes to his or her content.
  */
  var AppView, HomeController, Map, MarkerView, Memory, MemoryList, NavigationItemView, NavigationView;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  _.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g
  };
  Memory = (function() {
    __extends(Memory, Backbone.Model);
    function Memory() {
      Memory.__super__.constructor.apply(this, arguments);
    }
    Memory.prototype.escapedJson = function() {
      var json;
      return json = {
        title: this.escape("title"),
        author: this.escape("author"),
        date: this.get("date"),
        place: this.escape("place"),
        description: this.escape("description"),
        id: this.get("id")
      };
    };
    Memory.prototype.getSafe = function(fieldName) {
      var tmp;
      tmp = document.createElement("DIV");
      tmp.innerHTML = this.get(fieldName);
      return tmp.textContent || tmp.innerText;
    };
    Memory.prototype.getDate = function() {
      return new Date(Date.parse(this.get("date")));
    };
    return Memory;
  })();
  MemoryList = (function() {
    __extends(MemoryList, Backbone.Collection);
    function MemoryList() {
      MemoryList.__super__.constructor.apply(this, arguments);
    }
    MemoryList.prototype.model = Memory;
    MemoryList.prototype.memoriesForYear = function(year) {
      if (year === "Any") {
        return this.models;
      }
      return this.filter(function(memory) {
        return year === "Any" || memory.getDate().getFullYear().toString() === year;
      });
    };
    return MemoryList;
  })();
  Map = (function() {
    __extends(Map, Backbone.Model);
    function Map() {
      Map.__super__.constructor.apply(this, arguments);
    }
    Map.prototype.initialize = function(options) {
      this.url = "/maps/" + options.mapId;
      return this.__memories.url = "/memories/";
    };
    Map.prototype.set = function(attributes) {
      Map.__super__.set.call(this, attributes);
      if (attributes.memories != null) {
        if (!this.__memories) {
          this.__memories = new MemoryList();
        }
        return this.__memories.refresh(this.attributes.memories);
      }
    };
    Map.prototype.get = function(attribute) {
      if (attribute === "memories") {
        return this.__memories;
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
    MarkerView.prototype.template = _.template("<div class='marker-content'>\n    <div class='marker-header'>\n        <span class='title'>{{ title }}</span>\n        <span class='meta'>Added by {{ author }} on {{ date }}</span>\n    </div>\n    <div class='marker-place'><emphasis>{{ place }}</emphasis></div>\n    <div class='marker-description'>{{ description }}</div>\n    <a class='edit-marker' name='edit-marker' href='#markers/marker/edit/{{ id }}'>Edit</a>\n</div>");
    MarkerView.prototype.editTemplate = _.template("<div class='marker-edit-form'>\n    <form id='marker-edit'>\n    <input id='title' name='title' type='text' value='{{ title }}' placeholder='Title'>\n    <input id='place' name='place' type='text' value='{{ place }}' placeholder='Place'>\n    <textarea id='description-{{ id }}' name='description' rows=25 cols=45 placeholder='Description'>\n        {{ description }}\n    </textarea>\n    <a class='save-button' name='save-button' href='#markers/marker/save/{{ id }}'>Save</a>\n    <a class='cancel-button' name='cancel-button' href='#markers/marker/cancel/{{ id }}'>Cancel</a>\n</div>");
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
      return this.toggle();
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
    NavigationItemView.prototype.template = _.template("<li>\n    <h3><a href='#markers/marker/open/{{ id }}'>{{ title }}</a></h4>\n    <p>{{ description }}</p>\n</li>");
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
      _.bindAll(this, 'render', 'addMemory', 'AddMemoriesForYear', 'remove', 'getSelectedYear');
      this.itemViews = [];
      this.selectId = this.options.selectId || "year";
      this.year = this.getSelectedYear();
      this.id = this.id || "navigation";
      this.collection.bind('add', this.addMemory);
      this.collection.bind('refresh', this.render);
      return this.render();
    };
    NavigationView.prototype.addMemory = function(memory) {
      var view;
      view = new NavigationItemView({
        model: memory
      });
      return this.itemViews.push(view);
    };
    NavigationView.prototype.addMemoriesForYear = function(year) {
      var memories;
      memories = this.collection.memoriesForYear(year);
      return $.each(memories, __bind(function(_, memory) {
        return this.addMemory(memory);
      }, this));
    };
    NavigationView.prototype.render = function() {
      if (this.slider == null) {
        this.renderSlider();
      }
      this.remove();
      this.addMemoriesForYear(this.year);
      return $.each(this.itemViews, function() {
        return this.render();
      });
    };
    NavigationView.prototype.renderSlider = function() {
      var monthSelect, yearSelect;
      yearSelect = $("#" + this.selectId);
      monthSelect = $("#month");
      return yearSelect.change(__bind(function() {
        var option;
        option = yearSelect.children("option:selected");
        return this.yearChanged();
      }, this));
    };
    NavigationView.prototype.remove = function() {
      if (this.itemViews) {
        $.each(this.itemViews, function() {
          return this.remove();
        });
        return this.itemViews = [];
      }
    };
    NavigationView.prototype.getSelectedYear = function() {
      var option;
      option = $("#" + this.selectId).children("option:selected");
      return option.val();
    };
    NavigationView.prototype.yearChanged = function() {
      var year;
      year = this.getSelectedYear();
      if (!(this.year != null) || this.year !== year) {
        this.year = year;
        this.render();
        return this.trigger("nav:yearChanged", year);
      }
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
      _.bindAll(this, "addMemoriesForYear", "addMemory", "render", "remove");
      this.googleMap = null;
      this.markerViews = [];
      this.navigationView = new NavigationView({
        collection: this.model.get('memories')
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
      this.navigationView.bind("nav:yearChanged", this.filterMarkers);
      this.model.get('memories').bind("refresh", this.filterMarkers);
      this.model.get('memories').bind("add", this.addMemory);
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
    AppView.prototype.render = function(year) {
      var latestMemory;
      this.remove();
      this.addMemoriesForYear(year);
      latestMemory = this.markerViews[this.markerViews.length - 1];
      if (latestMemory !== void 0) {
        return this.googleMap.panTo(latestMemory.marker.getPosition());
      } else {

      }
    };
    AppView.prototype.filterMarkers = function() {
      return this.render(this.navigationView.getSelectedYear());
    };
    AppView.prototype.addMemory = function(memory) {
      return this.markerViews.push(new MarkerView({
        model: memory,
        map: this.googleMap,
        infoWindow: this.infoWindow
      }));
    };
    AppView.prototype.addMemoriesForYear = function(year) {
      var memories;
      memories = this.model.get('memories').memoriesForYear(year);
      return $.each(memories, __bind(function(_, memory) {
        return this.addMemory(memory);
      }, this));
    };
    AppView.prototype.remove = function() {
      this.infoWindow.close();
      return $.each(this.markerViews, __bind(function() {
        return this.remove();
      }, this));
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
  window.HomeController = HomeController;
  window.MemoryList = MemoryList;
  window.Map = Map;
}).call(this);

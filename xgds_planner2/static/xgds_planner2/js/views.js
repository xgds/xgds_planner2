    app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function(){ app.vent.trigger('mapmode', 'navigate'); },
        'click #btn-reposition': function(){ app.vent.trigger('mapmode', 'reposition'); },
        'click #btn-addStations': function(){ app.vent.trigger('mapmode', 'addStations'); },
        'click #btn-save': function(){ app.simulatePlan(); app.currentPlan.save() },
        'click #btn-delete': 'deleteSelectedCommands',
	'click #btn-undo': function(){ app.Actions.undo(); },
	'click #btn-redo': function(){ app.Actions.redo(); },
	'click #btn-reverse': 'reverseStations'
    },
    
    initialize: function(){
        this.listenTo( app.vent, 'mapmode', this.ensureToggle);

        this.listenTo( app.vent, 'change:plan', function(model) {this.updateSaveStatus('change')});
        this.listenTo( app.currentPlan, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo( app.currentPlan, 'error', function(model) {this.updateSaveStatus('error')});
        this.listenTo( app.vent, 'clearSaveStatus', function(model) {this.updateSaveStatus('clear')});
	this.listenTo( app.vent, 'undoEmpty', this.disableUndo);
	this.listenTo( app.vent, 'redoEmpty', this.disableRedo);
	this.listenTo( app.vent, 'undoNotEmpty', this.enableUndo);
	this.listenTo( app.vent, 'redoNotEmpty', this.enableRedo);
    },

    onRender: function() {
	if (app.Actions.undoEmpty())
	    this.disableUndo();
	else
	    this.enableUndo();
	if (app.Actions.redoEmpty())
	    this.disableRedo();
	else
	    this.enableRedo();
    },

    reverseStations: function() {
	app.vent.trigger("plan:reversing");
	app.currentPlan.get('sequence').models.reverse();
	app.currentPlan.get('sequence').resequence();
	app.vent.trigger("plan:reverse");
    },

    disableUndo: function() {
	this.$("#btn-undo").attr("disabled", "disabled");
    },

    disableRedo: function() {
	this.$("#btn-redo").attr("disabled", "disabled");
    },

    enableUndo: function() {
	this.$("#btn-undo").removeAttr("disabled");
    },

    enableRedo: function() {
	this.$("#btn-redo").removeAttr("disabled");
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-'+modeName);
        if ( ! btn.hasClass('active') ) { btn.button('toggle'); }
    },

    deleteSelectedCommands: function(){
        var commands = app.request('selectedCommands');
        _.each(commands, function(command){
            command.collection.remove(command);
            command.destroy();
        });
    },

    updateSaveStatus: function(eventName){
        var msgMap = {
            'change': "Unsaved changes.",
            'sync': "Plan saved.",
            'error': "Save error.",
            'clear': '',
        };
        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
    },
});

app.views.PlanMetaView = Backbone.Marionette.ItemView.extend({
    // Responsible for rendering the "Meta" tab
    template: '#template-meta-tab',
    serializeData: function(){
        data = this.model.toJSON();
        data.sites = app.planLibrary.sites;
        data.platforms = app.planLibrary.platforms;
        return data;
    },
    events: {
        'change form#meta': 'updatePlan',
    },
    updatePlan: function(evt){
        var control = $(evt.target);
        var key = control.attr('name');
        var value = control.val();
        if ( key == 'site' ) { 
            value = _.find(app.planLibrary.sites, function(s){ return s.id == value; });
        }
        if ( key == 'platform' ) { 
            value = _.find( app.planLibrary.platforms, function(p) { return p.id == value } );
        }
        this.model.set(key, value);
    },
});

app.views.PlanSequenceView = Backbone.Marionette.Layout.extend({
    template: '#template-sequence-view',

    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',

        //Column content
        col1: '#col1',
        col2: '#col2',
        col3: '#col3',
    },

    initialize: function(){
        this.listenTo( app.vent, 'showItem', this.showItem, this);
        this.listenTo( app.vent, 'showItem:station', this.showStation, this);
        this.listenTo( app.vent, 'showItem:segment', this.showSegment, this);
        this.listenTo( app.vent, 'showItem:command', this.showCommand, this);
        this.listenTo( app.vent, 'showMeta', this.showMeta, this);
        this.listenTo( app.vent, 'showPresets', this.showPresets, this);
        this.listenTo( app.vent, 'all', function(evt){
            console.log("PlanSequenceView event: "+evt);
        });
    },

    onClose: function(){
        this.stopListening();
    },

    onRender: function(){
        app.psv = this;
        var sscView = new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence'),   
        });
        this.col1.show(sscView);
    },

    showStation: function(itemModel){
        // Clear columns
        this.col3.close();

        var view = new app.views.CommandSequenceCollectionView( { model: itemModel, collection: itemModel.get('sequence') } );
        this.col2.show( view );

       this.showMeta(itemModel); 
    },

    showSegment: function(itemModel){
        this.col3.close(); 

        var view = new app.views.CommandSequenceCollectionView( { model: itemModel, collection: itemModel.get('sequence') } );
        this.col2.show( view );

        this.showMeta(itemModel); 
    },

    showCommand: function(itemModel){
        this.col3.close();
        var view = new app.views.PropertiesForm( {model: itemModel, readonly: app.options.readonly} );
        this.col3.show(view);
    },

    showMeta: function(model){
        this.col3.show( new app.views.PropertiesForm({
            model: model,
        }) );
    },

    showPresets: function(itemModel) {
        this.col3.show( new app.views.CommandPresetsView({
            model: itemModel,
        }) );
    },

});

app.views.makeExpandable = function(view, expandClass){
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's "expand" event is triggered, it will display it's chevron and trigger
     * the global "viewExpanded" event.  On recieving a global "viewExpoanded" event with an
     * expandClass that matches its own, the view will remove it's chevron.
    */
    var expandable = {
        expand: function(){
            var expandClass = this.options.expandClass; 
            this.expanded = true;
            this._ensureIcon();
            this.$el.find('i').addClass('icon-chevron-right');
            app.vent.trigger('viewExpanded', this, expandClass);
        },
        unexpand: function(){
            this.expanded = false;
            this.$el.find('i').removeClass('icon-chevron-right');
        },
        onExpandOther: function(target, expandClass){
            if ( this.options.expandClass === expandClass && this != target ) {
                this.unexpand();
            }
        },
        _ensureIcon: function(){
            if ( view.$el.find('i').length == 0){
                view.$el.append('<i/>');
            }
        }
    };
    view = _.defaults(view, expandable);
    view.option = _.defaults( view.options, {expandClass: expandClass});
    view.listenTo( app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view.expand, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(){
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data){
        //return '' + data.model.toString()+ ' <i/>';
        return '{model.toString} <span class="duration">{timing}</span><i/>'.format(data);
    },
    serializeData: function(){
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function(){
        return {
            'data-item-id': this.model.cid,
            'class': this.model.get('type').toLowerCase() + '-sequence-item',
        };
    },
    events: {
        click: function(){
            this.triggerMethod('expand');  // trigger the "expand" event AND call this.onExpand()
        },
    },
    modelEvents: {
        "change": "render", // Re-render when the model changes.
    },
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    onExpand: function(){
        var type = this.model.get('type'); // "Station" or "Segment"
        app.vent.trigger('showItem:'+type.toLowerCase(), this.model);
    },
    serializeData: function(){
        var data =  app.views.SequenceListItemView.prototype.serializeData.call(this, arguments);
	if (this.model.get('type') == "Station") {
            data.timing = app.util.minutesToHMS(this.model.getCumulativeDuration());
	} else {
	    data.timing = "+" + app.util.minutesToHMS(this.model.getDuration());
	}
        return data;
    },
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    itemView: app.views.PathElementItemView,
    itemViewOptions:{
        expandClass: 'col1',
    },
    initialize: function() {
	// re-render on plan save because for some reason, the collection
	// is re-rendered, reversed, on save.
	this.listenTo(app.currentPlan, "sync", this.render);
	app.vent.on("station:change", this.render);
	app.vent.on("plan:reverse", this.render);
    }
});

app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data){
        var displayName =  data.presetCode || data.name || data.presetName;
	var timing = app.util.minutesToHMS(data.duration);
        return '<input class="select" type="checkbox"/>' + displayName + " <span class=\"duration\">" + timing +'</span><i/>';
    },
    events: function(){
        return _.extend( app.views.SequenceListItemView.prototype.events, {
            'click input.select': this.toggleSelect,
        });
    },
    initialize: function(){
        app.views.SequenceListItemView.prototype.initialize.call(this);
    },
    onRender: function(){
        this.$el.css( "background-color", app.request( 'getColor', this.model.get('type') ) );
    },
    onExpand: function(){
        app.vent.trigger('showItem:command', this.model);
    },
    isSelected: function(evt){
        return this.$el.find('input.select').is(':checked');
    },
    toggleSelect: function(evt){
        evt.stopPropagation();
    }
});

app.views.MiscItemView = app.views.SequenceListItemView.extend({
    tagName: 'li',
    initialize: function(){
        var options = this.options;
        if ( options.extraClass ) {
            this.className = this.className ? this.className + ' ' + options.extraClass : options.extraClass;
        }
        this.on('click', function(){this.trigger('expand', this, this.options.expandClass);}, this);
        if ( options.click ) {
            this.on('click', this.options.click, this);
        }
        app.views.makeExpandable(this, this.options.expandClass);
    },
    render: function(){
        // override default render behavior with nothing, since contents can be pre-rendered in templates
    },
});

app.views.CommandSequenceCollectionView = Backbone.Marionette.CompositeView.extend({
    template: '#template-sequence-list-station',
    itemView: app.views.CommandItemView,
    itemViewContainer: '.command-list',
    itemViewOptions: {
        selectable: true,
        expandClass: 'col2',
    },
    events: {
        "click .edit-meta": function(evt){ app.vent.trigger('showMeta', this.model); },
        "click .add-commands": function(evt){ app.vent.trigger('showPresets', this.model); },
	"sortstop .command-list": function(evt,ui){
	    var commandOrder = this.$el.find('.command-list').sortable("toArray",{"attribute":"data-item-id"});
	    var oldOrder = this.model.get('sequence').models.map(function(model){
		return model.cid;
	    });
	    if (JSON.stringify(commandOrder) == JSON.stringify(oldOrder))
		// no change in order
		return;
	    var commandModels = commandOrder.map(function(cid){
		return this.model.get('sequence').filter(function(child){
		    return child.cid == cid
		})[0]
	    }, this);
	    this.model.get('sequence').models = commandModels;
	    app.vent.trigger('change:plan');
	}
    },
    initialize: function(){
        app.reqres.addHandler('selectedCommands', this.getSelectedCommands, this);
    },

    getSelectedCommands: function(){
        var commands = [];
        this.children.each(function(view){
            if (view.isSelected()) { commands.push(view.model); }
        });
        return commands;
    },

    onRender: function(){
        this.head = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
        });
        this.foot = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
        });
        this.head.setElement( this.$el.find('.edit-meta') );
        this.foot.setElement( this.$el.find('.add-commands') );
        this.head.render();
        this.foot.render();
        //var container = this.$el.find('.sequence-list');
        //container.prepend(this.head.el);
        //container.append(this.foot.el);
	this.$el.find('.command-list').sortable();
    },
});


/*
** PropertiesForm is a hybrid between Marionette.ItemView and Backbone.Form (from the backbone-forms extension).
** Becuase it extends Marionette.ItemView, it can be used cleanly with a region manager.
**
** It has two other important properties:
** 1) It updates its model immediately in response to field value changes.
** 2) It can be made read-only
*/
app.views.PropertiesForm = Backbone.Marionette.ItemView.extend(Backbone.Form.prototype).extend({

    initialize: function(){
        var readonly = this.options.readonly || app.options.readonly;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || this.options.model.schema;
        var schema = this.options.schema;

        _.each(schema, function(field, key){
            // Objectify any fields that are defined only by a type string
            if (_.isString( field) ) { field = {type: field}; }

            if (readonly) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true,
                };
            }
            schema[key] = field;
        });

        Backbone.Form.prototype.initialize.call(this, this.options);
        this.model.on('change', this.update, this);
    },

    update: function(){
        var attrs = this.model.changedAttributes();
        var formView = this;
        _.each( _.keys(attrs), function(k) {
            var v = attrs[k];
            formView.setValue(k,v);
        })
    },

    render: function(){
        Backbone.Form.prototype.render.apply(this, arguments);
        this.$el.on('change', _.bind(this.commit, this));
    },

});

app.views.CommandPresetsView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets',

    serializeData: function(){
        return {
            presets: this.getRelevantPresets(),
            station: this.model.toJSON(),
        }
    },

    events: {
        "click .add-preset": function(evt){
            var station = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            station.appendCommandByPreset( preset );
	    app.vent.trigger("change:plan");
        },
    },

    getRelevantPresets: function(){
        var presets;
        // Lists of command types that pertain to Stations and Segments are available in
        // planSchema.StationSequenceCommands and planSchema.SegmentSequenceCommands, respectively
        var relevantCommandTypes = app.planSchema[this.model.get('type').toLowerCase() + 'SequenceCommands'];
        if ( _.isUndefined(relevantCommandTypes) ) { 
            presets = app.planLibrary.commands; 
        } else { 
            presets = _.filter( app.planLibrary.commands, function(command) { return _.contains( relevantCommandTypes, command.type ) } ); 
        }
        return presets
    },
})

app.views.LayerTreeView = Backbone.Marionette.ItemView.extend({
    template: '#template-layer-tree',
    onRender: function(){
	app.vent.trigger("layerView:onRender");
        var tree = kmltree({
            url: app.options.layerFeedUrl,
            gex: ge.gex,
            mapElement: $('#map'),
            element: this.$el.find('#layertree'),
            restoreState: true
        });
        tree.load();
    },
});

app.views.PlanToolsView = Backbone.View.extend({
    template: '#template-plan-tools',
    events: {
	"click #ok-button": "okClicked"
    },
    initialize: function() {
	var source = $(this.template).html();
	if (_.isUndefined(source))
	    this.template = function() {
		return "";
	    };
	else
	    this.template = Handlebars.compile(source);
	this.listenTo(app.vent, "clearAppendTool", this.clearAppendTool);
	this.listenTo(app.vent, "setAppendError", this.setAppendError);
    },
    render: function() {
	this.$el.html(this.template({
	    planIndex: app.planIndex
	}));
    },
    okClicked: function() {
	var selectPlan = parseInt(this.$("#plan-select").val());
	var planUrl = undefined;
	_.each(app.planIndex, function(plan) {
	    if (plan.id == selectPlan) {
		planUrl = plan.url;
	    }
	});
	if (_.isUndefined(planUrl))
	    // no plan selected
	    return;
	this.$("#ok-button").attr("disabled", "disabled");
	this.$("#append-error").empty();
	app.reversePlanOnAppend = this.$("#reverse-plan").is(":checked");
	app.prependPlanOnAppend = this.$("#prepend-plan").is(":checked");
	$.getJSON(planUrl).done(this.appendPlan).error(this.failAppendPlan);
    },
    failAppendPlan: function() {
	app.vent.trigger("clearAppendTool");
	app.vent.trigger("setAppendError", "Error gettting plan to append");
    },
    setAppendError: function(message) {
	this.$("#append-error").empty().append(message);
    },
    clearAppendTool: function() {
	this.$("#ok-button").removeAttr("disabled");
	this.$("#append-error").empty();
	delete app.reversePlanOnAppend;
	delete app.prependPlanOnAppend;
    },
    appendPlan: function(data) {
	console.log(data);
	if (data.sequence.length == 0) {
	    // no sequence to add
	    app.vent.trigger("clearAppendTool");
	    return;
	}
	if (app.reversePlanOnAppend)
	    data.sequence.reverse();
	delete app.reversePlanOnAppend;
	var method = undefined;
	var sequence = app.currentPlan.get('sequence').models.slice();
	console.log("number of items");
	console.log(data.sequence.length);
	if (app.prependPlanOnAppend) {
	    console.log("adding connecting segment");
	    var segment = app.models.segmentFactory();
	    sequence.unshift(segment);
	    while (data.sequence.length > 0) {
		console.log("pushing item");
		console.log(data.sequence.length);
		var item = data.sequence.shift();
		var model = undefined;
		if (item.type == "Station") {
		    model = app.models.stationFactory(item);
		} else if (item.type == "Segment") {
		    model = app.models.segmentFactory(item);
		} else {
		    console.log("Error parsing sequence");
		    break;
		}
		sequence.unshift(model);
		console.log("pushed item");
		console.log(data.sequence.length + " items left");
		console.log(data.sequence.length > 0);
	    }
	} else {
	    console.log("adding connecting segment");
	    var segment = app.models.segmentFactory();
	    sequence.push(segment);
	    while (data.sequence.length > 0) {
		var item = data.sequence.shift();
		var model = undefined;
		if (item.type == "Station") {
		    model = app.models.stationFactory(item);
		} else if (item.type == "Segment") {
		    model = app.models.segmentFactory(item);
		} else {
		    console.log("Error parsing sequence");
		    break;
		}
		console.log("pushing item");
		console.log(data.sequence.length);
		sequence.push(model);
		console.log("pushed item");
		console.log(data.sequence.length + " items left");
		console.log(data.sequence.length > 0);
	    }
	}
	delete app.prependPlanOnAppend;
	app.Actions.disable();
	app.currentPlan.get('sequence').models = sequence;
	app.currentPlan.get('sequence').resequence();
	app.vent.trigger("clearAppendTool");
	app.Actions.enable();
	app.vent.trigger("change:plan");
    }
});

app.views.TabNavView = Backbone.Marionette.Layout.extend({
    template: '#template-tabnav',
    regions:{
        tabTarget: '#tab-target',
        tabContent: '#tab-content',
    },
    events: {
        'click ul.nav-tabs li': 'clickSelectTab',
    },

    viewMap: {
        //'meta': app.views.PlanMetaView,
        'meta': app.views.PropertiesForm,
        'sequence': app.views.PlanSequenceView,
        'layers': app.views.LayerTreeView,
	'tools': app.views.PlanToolsView
    },

    initialize: function(){
        this.on('tabSelected', this.setTab);
	// load layer tree ahead of time to load layers into map
	app.tree = null;
	app.vent.on('earth:loaded', function() {
	    app.tree = kmltree({
		url: app.options.layerFeedUrl,
		gex: ge.gex,
		mapElement: [],
		element: [],
		restoreState: true
	    });
	    app.tree.load();
	});
	app.vent.on('layerView:onRender', function() {app.tree.destroy()}); // remove tree once user loads layers tab
    },

    onRender: function(){
        if ( ! this.options.initialTab ) {
            this.options.initialTab = "meta";
        }
	if (!_.isUndefined(app.currentTab))
	    this.trigger('tabSelected', app.currentTab);
	else
            this.trigger('tabSelected', this.options.initialTab); 
    },

    clickSelectTab: function(event){
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode); 
    },
    
    setTab: function(tabId) {
        var $tabList = this.$el.find('ul.nav-tabs li');
        $tabList.each(function(){
            li = $(this);
            if ( li.data('target') === tabId ) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewMap[tabId];
        if ( ! viewClass ) { return undefined; }
        var view = new viewClass({
	    model: app.currentPlan,
        });
        this.tabContent.show(view);
	app.vent.trigger("tab:change",tabId);
    },
    
});


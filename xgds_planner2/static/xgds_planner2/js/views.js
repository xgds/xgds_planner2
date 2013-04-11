    app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function(){ app.vent.trigger('mapmode', 'navigate'); },
        'click #btn-reposition': function(){ app.vent.trigger('mapmode', 'reposition'); },
        'click #btn-addStations': function(){ app.vent.trigger('mapmode', 'addStations'); },
        'click #btn-save': function(){ app.currentPlan.save() },
        'click #btn-delete': 'deleteSelectedCommands',
    },
    
    initialize: function(){
        app.vent.on('mapmode', this.ensureToggle);
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-'+modeName);
        if ( ! btn.hasClass('active') ) { btn.button('toggle'); }
    },

    deleteSelectedCommands: function(){
        var commands = app.request('selectedCommands');
        _.each(commands, function(command){
            command.destroy();
        });
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
        app.vent.on('showItem', this.showItem, this);
        app.vent.on('showItem:station', this.showStation, this);
        app.vent.on('showItem:segment', this.showSegment, this);
        app.vent.on('showItem:command', this.showCommand, this);
        app.vent.on('showMeta', this.showMeta, this);
        app.vent.on('showPresets', this.showPresets, this);
        app.vent.on('all', function(evt){
            console.log("PlanSequenceView event: "+evt);
        });
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
        this.col2.close();
        this.col3.close();

        var view = new app.views.CommandSequenceCollectionView( { model: itemModel, collection: itemModel.get('sequence') } );
        this.col2.show( view );

       this.showMeta(itemModel); 
    },

    showSegment: function(itemModel){
        this.col2.close();
        this.col3.close(); 

        var view = new app.views.CommandSequenceCollectionView( { model: itemModel, collection: itemModel.get('sequence') } );
        this.col2.show( view );

        this.showMeta(itemModel); 
    },

    showCommand: function(itemModel){
        this.col3.close();
        var view = new app.views.CommandPropertiesFormView( {model: itemModel, readonly: app.options.readonly} );
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
    app.vent.on('viewExpanded', view.onExpandOther, view);
    view.on('expand', view.expand, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build it's own root element.
    tagName: 'li',
    template: function(data){
        return '' + data.model.toString()+ ' <i/>';
    },
    serializeData: function(){
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function(){
        return {
            'data-item-id': this.model.get('id'),
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
    initialize: function(){
        app.views.makeExpandable(this, this.options.expandClass);
    },
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    onExpand: function(){
        var type = this.model.get('type'); // "Station" or "Segment"
        app.vent.trigger('showItem:'+type.toLowerCase(), this.model);
    },
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    itemView: app.views.PathElementItemView,
    itemViewOptions:{
        expandClass: 'col1',
    },
});

app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data){
        var displayName =  data.presetCode || data.name;
        return '<input class="select" type="checkbox"/>' + displayName + '<i/>';
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
    },
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

    events:{
        'change': 'commit', // Update the associated Model object everytime the form input values change.
    },
    initialize: function(){
        var readonly = this.options.readonly || app.options.readonly;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || _.extend({}, this.options.model.schema);
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
        this.model.on('change', this.render, this);
    },

});


app.views.CommandPropertiesFormView = app.views.PropertiesForm.extend({
    initialize: function(){
        var readonly = this.options.readonly;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        var schema = this.options.schema = {};
        var commandSpec = app.commandSpecs[this.model.get('type')];
        _.each(commandSpec.params, function(param){
            var field = {type: app.models.paramTypeHash[param.valueType]};
            schema[param.id] = field;
        });

        app.views.PropertiesForm.prototype.initialize.call(this, this.options);
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
            console.log("Add by preset");
            var station = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            station.appendCommandByPreset( preset );
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
        'meta': app.views.PlanMetaView,
        'sequence': app.views.PlanSequenceView,
    },

    initialize: function(){
        this.on('tabSelected', this.setTab);
    },

    onRender: function(){
        if ( ! this.options.initialTab ) {
            this.options.initialTab = "meta";
        }
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
        var view = new viewClass({
            model: app.currentPlan,
        });
        this.tabContent.show(view);
    },
    
});


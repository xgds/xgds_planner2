// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addStations': function() { app.vent.trigger('mapmode', 'addStations'); this.updateTip('add');},
        'click #btn-save': function() { app.simulatePlan(); app.currentPlan.save() },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); }
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
        this.listenTo(app.vent, 'change:plan', function(model) {this.updateSaveStatus('change')});
        this.listenTo(app.currentPlan, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo(app.currentPlan, 'error', function(model) {this.updateSaveStatus('error')});
        this.listenTo(app.vent, 'clearSaveStatus', function(model) {this.updateSaveStatus('clear')});
        this.listenTo(app.vent, 'readOnly', function(model) {this.updateSaveStatus('readOnly')});
        this.listenTo(app.vent, 'readOnly', this.disableForReadOnly);
        this.listenTo(app.currentPlan, 'sync', this.refreshSaveAs);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.currentPlan, 'change:planVersion', this.handleVersionChange);
    },

    onShow: function() {
        if (!app.State.mapHeightSet) {
            var offset = this.$el.height() +
                parseFloat(this.$el.parent().css('margin-top')) +
                parseFloat(this.$el.parent().css('margin-bottom')) +
                10; // this exact number is needed because jquery ui uses
            // elements with absolute positioning for the resize handles
            var pageContentElement = $('#page-content');
            var oldMapHeight = app.map.$el.height();
            var initialHeight = oldMapHeight - offset;
            app.map.$el.height(initialHeight);
            app.map.$el.css('max-height', initialHeight + 'px');
            $(window).bind('resize', function() {
                app.map.$el.css('max-height', (pageContentElement.height() - offset) + 'px');
            });
            app.State.mapHeightSet = true;
        }
    },

    onRender: function() {
        if (app.Actions.undoEmpty()) {
            this.disableUndo();
        } else {
            this.enableUndo();
        }
        if (app.Actions.redoEmpty()) {
            this.disableRedo();
        } else {
            this.enableRedo();
        }
    },

    disableForReadOnly: function() {
        this.$('#btn-addStations').attr('disabled', 'true');
        this.$('#btn-reposition').attr('disabled', 'true');
        this.$('#btn-save').attr('disabled', 'true');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'true');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'true');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { 
            btn.prop("checked", true); 
            btn.addClass('active');
        }
        // turn off the others
        btn.siblings().each(function() {
            $(this).prop("checked", false);
            $(this).removeClass("active");
        });
    },

    updateSaveStatus: function(eventName) {
        var msgMap = {
            'change': 'Unsaved changes.',
            'sync': 'Plan saved.',
            'error': 'Save error.',
            'clear': '',
            'readOnly': 'Plan is LOCKED.'
        };
        if (app.options.readOnly) {
            eventName = 'readOnly';
        }
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error' || eventName == 'readOnly') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Shift click to delete stations, click & drag the blue dot to edit.',
            'add': 'Click to add stations to end.  Double-click last station.',
            'clear': 'Click and drag to pan map.'
        };
        var msg = msgMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    refreshSaveAs: function(model, response) {
        var text = response.responseText;
        if (response.data != null) {
            var newId = response.data;
            if (newId != null) {
                document.location.href = newId;
            } else {
                app.vent.trigger('sync');
            }
        } else {
            app.vent.trigger('sync');
        }
    },

    handleVersionChange: function(model, response) {
        // update the plan id in case the version has changed
        var version = app.currentPlan.get('planVersion');
        if (!_.isUndefined(version)){
            app.currentPlan.set('planVersion', version.toUpperCase());
        } else {
            app.currentPlan.set('planVersion', 'A');
        }
        var planIdTemplate = app.planSchema.planIdFormat;
        var context = {
                plan: app.currentPlan.toJSON()
        };
        var planId = planIdTemplate.format(context);

        app.currentPlan.set('id', planId);
        app.currentPlan.get('sequence').resequence();
    },

    showSaveAsDialog: function() {
        $('#saveAsName').val(app.currentPlan.attributes['name']);
        var version = app.currentPlan.attributes['planVersion'];
        if (version != '') {
            var newVersion = String.fromCharCode(version.charCodeAt(0) + 1).toUpperCase();
        } else {
            var newVersion = 'A';
        }
        $('#saveAsVersion').val(newVersion);
        $('#saveAsNotes').val(app.currentPlan.attributes['notes']);
        $('#saveAsDialog').dialog({
            dialogClass: 'no-close',
            modal: false,
            resizable: true,
            closeOnEscape: true,
            buttons: {
                'Cancel': function() {
                    $(this).dialog('close');
                },
                'Save': function() {
                    var newName = $('#saveAsName').val();
                    var newVersion = $('#saveAsVersion').val();
                    var newNotes = $('#saveAsNotes').val();
                    app.currentPlan.set('planName', newName);
                    app.currentPlan.set('planVersion', newVersion);
                    app.currentPlan.set('name', newName);
                    app.currentPlan.set('notes', newNotes);
                    app.currentPlan.set('uuid', null);
                    app.currentPlan.save();
                    $(this).dialog('close');
                }
            },
            position: {
                my: 'right top',
                at: 'right bottom',
                of: '#tab-buttons'
            },
            dialogClass: 'saveAs'
        });
    }

});

app.views.PlanMetaView = Backbone.Marionette.ItemView.extend({
    // Responsible for rendering the 'Meta' tab
    template: '#template-meta-tab',
    serializeData: function() {
        data = this.model.toJSON();
        data.sites = app.planLibrary.sites;
        data.platforms = app.planLibrary.platforms;
        return data;
    },
    events: {
        'change form#meta': 'updatePlan'
    },
    updatePlan: function(evt) {
        var control = $(evt.target);
        var key = control.attr('name');
        var value = control.val();
        if (key == 'site') {
            value = _.find(app.planLibrary.sites, function(s) { return s.id == value; });
        }
        if (key == 'platform') {
            value = _.find(app.planLibrary.platforms, function(p) { return p.id == value });
        }
        this.model.set(key, value);
    }
});

app.views.PlanSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-plan-sequence-header'
});

app.views.StationSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-station-sequence-header',
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._sequenceLabel;
        return data;
    }
});

app.views.SegmentSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-segment-sequence-header',
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._sequenceLabel;
        return data;
    }
});

app.views.StationPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-station-properties-header'
});

app.views.SegmentPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-segment-properties-header'
});

app.views.CommandPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-properties-header',
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._commandLabel;
        return data;
    }
});

app.views.CommandPresetsHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets-header'
});

app.views.HideableRegion = Backbone.Marionette.Region.extend({
    close: function() {
        Backbone.Marionette.Region.prototype.close.call(this);
        this.ensureEl();
        this.$el.hide();
    },
    show: function(view) {
        Backbone.Marionette.Region.prototype.show.call(this, view);
        this.$el.show();
    }
});

app.views.PlanSequenceView = Backbone.Marionette.LayoutView.extend({
    template: '#template-sequence-view',

    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',

        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2',
            regionType: app.views.HideableRegion
        },
        col3: {
            selector: '#col3',
            regionType: app.views.HideableRegion
        }
    },

    initialize: function() {
        //this.listenTo(app.vent, 'showItem', this.showItem, this);
        this.listenTo(app.vent, 'showItem:station', this.showStation, this);
        this.listenTo(app.vent, 'showItem:segment', this.showSegment, this);
        this.listenTo(app.vent, 'showItem:command', this.showCommand, this);
        this.listenTo(app.vent, 'showMeta', this.showMeta, this);
        this.listenTo(app.vent, 'showPresets', this.showPresets, this);
        this.listenTo(app.vent, 'showNothing', this.showNothing, this);
        //this.listenTo(this.col1, 'all', function(evt) {
        //    console.log('Event on column 1: ' + evt);
        //});
        //this.listenTo(this.col2, 'all', function(evt) {
        //    console.log('Event on column 2: ' + evt);
        //});
        //this.listenTo(this.col3, 'all', function(evt) {
        //    console.log('Event on column 3: ' + evt);
        //});
        //this.listenTo(app.vent, 'all', function(evt) {
        //    console.log('PlanSequenceView event: ' + evt);
        //});
    },

    onClose: function() {
        this.stopListening();
    },

    onRender: function() {
        try {
            this.colhead1.close();
            this.col1.close();
            this.col2.close();
            this.col3.close();
        } catch (err) {
            
        }
        var headerView = new app.views.PlanSequenceHeaderView({
        });
        this.colhead1.show(headerView);
        app.psv = this;
        var sscView = new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        });
        try {
            this.col1.show(sscView);
        } catch (ex) {
            console.log(ex);
        }
    },

    showStation: function(itemModel) {
        // Clear columns
        try {
            this.col3.close();
            this.colhead2.close();
        } catch (ex) {
        }
        var headerView = new app.views.StationSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        try {
            this.col2.close();
        } catch (ex) {
        }

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('sequence')});
        this.col2.show(view);
    },

    showSegment: function(itemModel) {
        try {
            this.col3.close();
            this.colhead2.close();
        } catch (ex) {
        }
        var headerView = new app.views.SegmentSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        try {
            this.col2.close();
        } catch (ex) {
        }

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('sequence')});
        this.col2.show(view);

        this.showMeta(itemModel);
    },

    showCommand: function(itemModel) {
        try {
            this.colhead3.close();
        } catch (ex) {
        }
        var headerView = new app.views.CommandPropertiesHeaderView({
            model: itemModel
        });
        this.colhead3.show(headerView);
        try {
            this.col3.close();
        } catch (ex) {
        }
        
        var view = new app.views.PropertiesForm({model: itemModel, readonly: app.options.readOnly});
        this.col3.show(view);
    },

    showMeta: function(model) {
        try {
            this.colhead3.close();
        } catch (ex) {
            
        }
        if (model.get('type') == 'Station') {
            var headerView = new app.views.StationPropertiesHeaderView();
        } else if (model.get('type') == 'Segment') {
            var headerView = new app.views.SegmentPropertiesHeaderView();
        } else if (model.get('type') == 'Command') {
            var headerView = new app.views.CommandPropertiesHeaderView();
        }
        this.colhead3.show(headerView);
        try {
            this.col3.close();
        } catch (ex) {
            
        }
        app.State.metaExpanded = true;
        app.State.addCommandsExpanded = false;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.PropertiesForm({
            model: model
        }));
    },

    showPresets: function(itemModel) {
        try {
            this.colhead3.close();
        } catch (ex) {
        }
        var headerView = new app.views.CommandPresetsHeaderView();
        this.colhead3.show(headerView);
        try {
            this.col3.close();
        }catch (ex) {
            
        }
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = true;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.CommandPresetsView({
            model: itemModel
        }));
    },

    showNothing: function() {
        // clear the columns
        try {
            this.col2.close();
            this.col3.close();
            this.colhead2.close();
            this.colhead3.close();
        } catch (ex) {
            
        }
    }
});

app.views.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != 'sequence') {
        // memory leak work around
        return;
    }
    var expandable = {
        expand: function() {
            this.trigger('expand');
        },
        _expand: function() {
            var expandClass = this.options.expandClass;
            this.expanded = true;
            this._addIcon();
            app.vent.trigger('viewExpanded', this, expandClass);
            if (!_.isUndefined(this.onExpand) && _.isFunction(this.onExpand)) {
                this.onExpand();
            }
        },
        unexpand: function() {
            //            console.log('(((((((Unexpanding');
            this.expanded = false;
            this.$el.find('i').removeClass('icon-play');
        },
        onExpandOther: function(target, expandClass) {
            //            console.log('Got onExpandOther');
            if (this.options.expandClass === expandClass && this != target && target.isClosed != true) {
                this.unexpand();
                //                console.log('target:');
                //                console.log(target);
            }
        },
        _ensureIcon: function() {
            if (view.$el.find('i').length == 0) {
                view.$el.append('<i/>');
            }
        },
        _restoreIcon: function() {
            //            console.log('!!!!!!!!!!!restoring icon');
            //            console.log('Expanded:', this.expanded);
            if (this.expanded) {
                this._addIcon();
            }
        },
        _addIcon: function() {
            this._ensureIcon();
            this.$el.find('i').addClass('icon-play');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.options = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data) {
        //return '' + data.model.toString()+ ' <i/>';
        return '{model.toString} <span class="duration">{timing}</span><i/>'.format(data);
    },
    serializeData: function() {
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function() {
        return {
            'data-item-id': this.model.cid,
            'class': this.model.get('type').toLowerCase() + '-sequence-item'
        };
    },
    events: {
        click: function() {
            this.expand();
        }
    },
    modelEvents: {
        'change': 'render'
    }
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    events: {
        click: function() {
            app.State.metaExpanded = true;
            app.State.addCommandsExpanded = false;
            app.State.commandSelected = undefined;
            this.expand();
            var type = this.model.get('type'); // "Station" or "Segment"
            app.vent.trigger('showItem:' + type.toLowerCase(), this.model);
        }
    },
    onExpand: function() {


    },
    serializeData: function() {
        var data = app.views.SequenceListItemView.prototype.serializeData.call(this, arguments);
        if (this.model.get('type') == 'Station') {
            data.timing = app.util.minutesToHMS(this.model.getCumulativeDuration());
        } else {
            data.timing = '+' + app.util.minutesToHMS(this.model.getDuration());
        }
        return data;
    }
});

app.views.NoStationsView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-stations'
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    childView: app.views.PathElementItemView,
    childViewOptions: {
        expandClass: 'col1'
    },
    emptyView: app.views.NoStationsView,
    initialize: function(options) {
        this.options = options || {};
        // re-render on plan save because for some reason, the collection
        // is re-rendered, reversed, on save.
        //app.State.stationSelected is our state variable
        this.listenTo(app.currentPlan, 'sync', this.render);
        this.listenTo(app.vent, 'station:change', this.render);
        this.listenTo(app.vent, 'plan:reverse', this.render);
        this.on('childview:expand', this.onItemExpand, this);
        //this.on('childview:render', this.restoreExpanded, this);
    },

    onItemExpand: function(childView) {
        app.State.stationSelected = childView.model;
    },

    restoreExpanded: function() {
        if (!_.isUndefined(app.State.stationSelected)) {
            var childView = this.children.findByModel(app.State.stationSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.stationSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.stationSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.stationSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        } else if (!_.isUndefined(app.State.segmentSelected)) {
            var childView = this.children.findByModel(app.State.segmentSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.segmentSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.segmentSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.segmentSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        }
    },

    onRender: function() {
        this.restoreExpanded();
    },

    onClose: function() {
        this.children.each(function(view) {
            view.close();
        });
    }

});

app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data) {
        var displayName = data.name || data.presetName || data.presetCode;
        var timing = app.util.minutesToHMS(data.duration);
        return '<input class="select" type="checkbox" id="id_' + displayName + '"/></i>&nbsp;<label style="display:inline-block;" for="id_' + displayName + '">' + displayName + '</label><span class="duration">' + timing + '</span><i/>';
    },
    events: function() {
        return _.extend(app.views.SequenceListItemView.prototype.events, {
            'click input.select': this.toggleSelect
        });
    },
    initialize: function(options) {
        this.options = options || {};
        app.views.SequenceListItemView.prototype.initialize.call(this);
    },
    onRender: function() {
        this.$el.css('background-color', app.request('getColor', this.model.get('type')));
    },
    onExpand: function() {
        app.vent.trigger('showItem:command', this.model);
    },
    isSelected: function(evt) {
        return this.$el.find('input.select').is(':checked');
    },
    setSelected: function() {
        this.$el.find('input.select').prop('checked', true);
    },
    setUnselected: function() {
        this.$el.find('input.select').prop('checked', false);
    },
    toggleSelect: function(evt) {
        if (this.isSelected()) {
            this.trigger('selected');
        } else {
            this.trigger('unselected');
        }
        evt.stopPropagation();
    },
    onClose: function() {
        this.stopListening();
    }
});

app.views.MiscItemView = app.views.SequenceListItemView.extend({
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        var options = this.options;
        if (options.extraClass) {
            this.className = this.className ? this.className + ' ' + options.extraClass : options.extraClass;
        }
        this.on('click', function() {this.trigger('expand', this, this.options.expandClass);}, this);
        if (options.click) {
            this.on('click', this.options.click, this);
        }
        app.views.makeExpandable(this, this.options.expandClass);
    },
    render: function() {
        // override default render behavior with nothing, since contents can be pre-rendered in templates
    }
});

app.views.NoCommandsView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-commands'
});

app.views.CommandSequenceCollectionView = Backbone.Marionette.CompositeView.extend({
    template: '#template-sequence-list-station',
    childView: app.views.CommandItemView,
    childViewContainer: '.command-list',
    childViewOptions: {
        expandClass: 'col2'
    },
    emptyView: app.views.NoCommandsView,
    events: {
        'click #btn-copy': 'copySelectedCommands',
        'click #btn-paste': 'pasteCommands',
        'click #btn-cut': 'cutSelectedCommands',
        'click #btn-delete': 'deleteSelectedCommands',
        'click .edit-meta': function(evt) {
            app.vent.trigger('showMeta', this.model);
        },
        'click .add-commands': function(evt) {
            app.vent.trigger('showPresets', this.model);
        },
        'sortstop .command-list': function(evt, ui) {
            var commandOrder = this.$el.find('.command-list').sortable('toArray', {'attribute': 'data-item-id'});
            var oldOrder = this.model.get('sequence').models.map(function(model) {
                return model.cid;
            });
            if (JSON.stringify(commandOrder) == JSON.stringify(oldOrder))
                // no change in order
                return;
            var commandModels = commandOrder.map(function(cid) {
                return this.model.get('sequence').filter(function(child) {
                    return child.cid == cid;
                })[0];
            }, this);
            this.model.get('sequence').models = commandModels;
            app.vent.trigger('change:plan');
        }
    },
    modelEvents: {
        //'change': 'close' // it's really stupid that we actually have to do this
    },
    initialize: function() {
        this.head = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
            events: {}
        });
        this.foot = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
            events: {}
        });
        this.head.setElement(this.$el.find('.edit-meta'));
        this.foot.setElement(this.$el.find('.add-commands'));
        this.head.render();
        this.foot.render();
        app.reqres.setHandler('selectedCommands', this.getSelectedCommands, this);
        app.reqres.setHandler('unselectAllCommands', this.unselectAll, this);
        app.reqres.setHandler('currentPathElement', function() {return this.model;}, this);
        if (_.isUndefined(app.State.metaExpanded))
            app.State.metaExpanded = true;
        if (_.isUndefined(app.State.addCommandsExpanded))
            app.State.addCommandsExpanded = false;
        this.on('childview:expand', this.onItemExpand, this);
        this.on('childview:selected', this.onItemSelected, this);
        this.on('childview:unselected', this.onItemUnSelected, this);
        this.itemsSelected = false;
        //this.on('childView:render', this.restoreExpanded, this);
        this.listenTo(app.vent, 'showMeta', function() {
            this.head.expand();
        });
        this.listenTo(app.vent, 'showPresets', function() {
            this.foot.expand();
        });
        //console.log('++++++new command sequence collection view created');
        //console.log('Presets/Meta/Command:', app.State.addCommandsExpanded,
        //            app.State.metaExpanded, app.State.commandSelected);
        //var stack = new Error().stack;
        //console.log(stack);
        this.listenTo(app.vent, 'commandsSelected', this.enableCommandActions);
        this.listenTo(app.vent, 'commandsUnSelected', this.disableCommandActions);
    },
    
    onItemSelected: function() {
        if (this.itemsSelected) return;
        if (!_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = true;
            app.vent.trigger('commandsSelected');
        }
    },

    onItemUnSelected: function() {
        if (!this.itemsSelected) return;
        if (_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = false;
            app.vent.trigger('commandsUnSelected');
        }
    },

    getSelectedCommands: function() {
        var commands = [];
        this.children.each(function(childView) {
            try {
                if (childView.isSelected()) { commands.push(childView.model); }
            } catch(ex) {
                //pass
            }
            
        });
        return commands;
    },

    getCommandCollection: function() {
        return this.collection;
    },

    unselectAll: function() {
        if (!_.isEmpty(this.children)) {
            this.children.each(function(view) {
                if (!_.isUndefined(view)){
                    view.setUnselected();
                }
            });
        }
    },

    onItemExpand: function(childView) {
        app.State.commandSelected = childView.model;
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = false;
    },

    restoreExpanded: function() {
        //console.log('restoring closed view:', this.isClosed);
        if (app.State.metaExpanded) {
            app.vent.trigger('showMeta', this.model);
        } else if (app.State.addCommandsExpanded) {
            //console.log('----expanding foot');
            app.vent.trigger('showPresets', this.model);
            //console.log(this.foot.expanded);
        } else if (!_.isUndefined(app.State.commandSelected)) {
            var childView = this.children.findByModel(app.State.commandSelected);
            if (_.isUndefined(childView)) {
                // try to find the model by id
                var childId = app.State.commandSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so view is gone
                    app.vent.trigger('showMeta', this.model);
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showMeta', this.model);
                    } else {
                        app.State.commandSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:command', childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:command', childView.model);
            }
        }
    },

    onRender: function() {
        //var container = this.$el.find('.sequence-list');
        //container.prepend(this.head.el);
        //container.append(this.foot.el);
        this.head.setElement(this.$el.find('.edit-meta'));
        this.foot.setElement(this.$el.find('.add-commands'));
        this.head.render();
        this.foot.render();
        this.$el.find('.command-list').sortable();
        this.restoreExpanded();
        if (app.hasHandler('selectedCommands') &&
                !_.isEmpty(app.request('selectedCommands'))) {
                this.enableCommandActions();
            } else {
                this.disableCommandActions();
            }
    },

    onClose: function() {
        //console.log('command sequence closed');
        //var stack = new Error().stack;
        //console.log(stack);
        this.head.close();
        this.foot.close();
        this.children.each(function(view) {
            view.close();
        });
        this.stopListening();
    },
    disableCommandActions: function() {
        this.$('#btn-copy').attr('disabled', 'true');
        if (!_.isEmpty(app.copiedCommands)){
            this.$('#btn-paste').removeAttr('disabled');
        } else {
            this.$('#btn-paste').attr('disabled', 'true');
        }
        this.$('#btn-cut').attr('disabled', 'true');
        this.$('#btn-delete').attr('disabled', 'true');
    },

    enableCommandActions: function() {
        this.$('#btn-copy').removeAttr('disabled');
        this.$('#btn-paste').removeAttr('disabled');
        this.$('#btn-cut').removeAttr('disabled');
        this.$('#btn-delete').removeAttr('disabled');
    },
    deleteSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        var selectParent = null;
        if (commands.length > 0){
            selectParent = commands[0].get('pathElement');
        }
        _.each(commands, function(command) {
            if (!_.isUndefined(command.collection)){
                command.collection.remove(command);
            }
            command.destroy();
        });
        app.vent.trigger('change:plan');
        if (selectParent != null){
            var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
            app.vent.trigger(showParent, selectParent);
        }
    },

    copySelectedCommands: function() {
        var commands = app.request('selectedCommands');
        app.copiedCommands = new Array();
        app.copiedCommands.push.apply(app.copiedCommands, commands);
        app.request('unselectAllCommands');
    },

    pasteCommands: function() {
        var model = app.request('currentPathElement');
        var sequence = model.get('sequence');
        var type = model.get('type');
        var cut = app.request('cutAfterPaste');
        _.each(app.copiedCommands, function(command) {
            sequence.add(command.clone());
            //TODO now you can paste a command into a container that should not contain it. Verify permitted, or validate.
            /*
            if (cut) {
                sequence.add(command.clone());
            } else if (command.get('pathElement').get('type') == type) {
                sequence.add(command.clone());
            } */
            
        });
        app.vent.trigger('change:plan');
    },

    cutSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        if (commands.length > 0){
            app.copiedCommands = new Array();
            app.copiedCommands.push.apply(app.copiedCommands, commands);
            
            // remove them from the collection
            var selectParent = null;
            selectParent = commands[0].get('pathElement');
            _.each(commands, function(command) {
                if (!_.isUndefined(command.collection)){
                    command.collection.remove(command);
                }
            });
            app.vent.trigger('change:plan');
            if (selectParent != null){
                var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
                app.vent.trigger(showParent, selectParent);
            }
            
            app.request('unselectAllCommands');
            app.vent.trigger('cutAfterPaste');
        }
    }
    
    
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
    template: '#template-properties-form',

    events: {
        'change': 'commitCheck'
    },

    modelEvents: {
        'change': 'update'
    },

    initialize: function(options) {
        this.options = options || {};
        var readOnly = this.options.readOnly || app.options.readOnly;
        var visible = this.options.visible;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || this.options.model.schema;
        this.options.data = this.options.data || this.options.model.data;
        this.Field = Backbone.Form.UnitField;
        this.template = Handlebars.compile($(this.template).html());
        var schema = this.options.schema;

        if (readOnly) {
            _.each(schema, function(field, key) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true
                };
                schema[key] = field;
            });
        }
        Backbone.Form.prototype.initialize.call(this, this.options);
    },

    commitCheck: function() {
        Backbone.Form.prototype.commit.apply(this, arguments);
    },

    update: function() {
        var attrs = this.model.changedAttributes();
        _.each(_.keys(attrs), function(k) {
            var v = attrs[k];
            this.setValue(k, v);
        }, this);
    }
});

app.views.CommandPresetsView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets',

    serializeData: function() {
        return {
            presets: this.getRelevantPresets(),
            station: this.model.toJSON()
        };
    },

    events: {
        'click .add-preset': function(evt) {
            var station = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            app.Actions.disable();
            station.appendCommandByPreset(preset);
            app.Actions.enable();
            app.vent.trigger('change:plan');
        }
    },

    getRelevantPresets: function() {
        var presets;
        // Lists of command types that pertain to Stations and Segments are available in
        // planSchema.StationSequenceCommands and planSchema.SegmentSequenceCommands, respectively
        var relevantCommandTypes = app.planSchema[this.model.get('type').toLowerCase() + 'SequenceCommands'];
        if (_.isUndefined(relevantCommandTypes)) {
            presets = app.planLibrary.commands;
        } else {
            presets = _.filter(app.planLibrary.commands, function(command) { return _.contains(relevantCommandTypes, command.type)});
        }
        // add timing info in HMS format
        _.each(presets, function(command) {
            if (_.has(command, 'duration')) {
                command.timing = app.util.minutesToHMS(command.duration);
            }
        });
        return presets;
    }
});


app.views.FancyTreeView = Backbone.View.extend({
    initialize: function() {
        this.listenTo(app.vent, 'refreshTree', function() {this.refreshTree()});
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else {
            this.template = Handlebars.compile(source);
        }
        _.bindAll(this, 'render', 'afterRender'); 
        var _this = this; 
        this.render = _.wrap(this.render, function(render) { 
            render(); 
            _this.afterRender(); 
            return _this; 
        }); 
    },
    template: '#template-layer-tree',
    render: function() {
        this.$el.html(this.template());
    },
    afterRender: function() {
        app.vent.trigger('layerView:onRender');
        if (!_.isUndefined(app.tree)) {
            // only remove if it's there in the first place
            return;
        }
        var layertreeNode = $("#layertree");
        this.createTree();
        return;
    },
    refreshTree: function() {
        if (!_.isUndefined(app.tree)){
            app.tree.reload({
                url: app.options.layerFeedUrl
            }).done(function(){
                //TODO implement
                app.vent.trigger('layerView:reloadKmlLayers');
            });
        }
    },
    createTree: function() {
        if (_.isUndefined(app.tree)){
            var layertreeNode = $("#layertree");
//            layertreeNode.detach();
//            $("#layertreeContainer").append(layertreeNode);
//            layertreeNode = $("#layertree");
            var mytree = layertreeNode.fancytree({
                extensions: ["persist"],
                source: app.treeData,
                checkbox: true,
                select: function(event, data) {
                    if (_.isUndefined(data.node.kmlLayerView)) {
                        // make a new one
                        app.vent.trigger('kmlNode:create', data.node);
                    } else {
                        data.node.kmlLayerView.render();
                    }
                  },
                  persist: {
                      // Available options with their default:
                      cookieDelimiter: "~",    // character used to join key strings
                      cookiePrefix: undefined, // 'fancytree-<treeId>-' by default
                      cookie: { // settings passed to jquery.cookie plugin
                        raw: false,
                        expires: "",
                        path: "",
                        domain: "",
                        secure: false
                      },
                      expandLazy: false, // true: recursively expand and load lazy nodes
                      overrideSource: true,  // true: cookie takes precedence over `source` data attributes.
                      store: "auto",     // 'cookie': use cookie, 'local': use localStore, 'session': use sessionStore
                      types: "active expanded focus selected"  // which status types to store
                    }
            });
            app.tree = layertreeNode.fancytree("getTree");
            app.vent.trigger('tree:loaded');
        }
    }
    
});


app.views.PlanToolsView = Backbone.View.extend({
    template: '#template-plan-tools',
    events: {
        'click #ok-button': 'okClicked',
        'click #btn-reverse': 'reverseStations',
    },
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else {
            this.template = Handlebars.compile(source);
        }
        this.listenTo(app.vent, 'clearAppendTool', this.clearAppendTool);
        this.listenTo(app.vent, 'setAppendError', this.setAppendError);
        _.bindAll(this, 'render', 'afterRender'); 
        var _this = this; 
        this.render = _.wrap(this.render, function(render) { 
            render(); 
            _this.afterRender(); 
            return _this; 
        }); 
    },
    render: function() {
        this.$el.html(this.template({
            planIndex: app.planIndex
        }));
    },
    afterRender: function() {
        if (app.options.readOnly) {
            this.disableForReadOnly();
        }
    },
    okClicked: function() {
        var selectPlan = parseInt(this.$('#plan-select').val());
        var planUrl = undefined;
        _.each(app.planIndex, function(plan) {
            if (plan.id == selectPlan) {
                planUrl = plan.url;
            }
        });
        if (_.isUndefined(planUrl))
            // no plan selected
            return;
        this.$('#ok-button').attr('disabled', 'true');
        this.$('#append-error').empty();
        app.reversePlanOnAppend = this.$('#reverse-plan').is(':checked');
        app.prependPlanOnAppend = this.$('#prepend-plan').is(':checked');
        $.getJSON(planUrl).done(this.appendPlan).error(this.failAppendPlan);
    },
    failAppendPlan: function() {
        app.vent.trigger('clearAppendTool');
        app.vent.trigger('setAppendError', 'Error gettting plan to append');
    },
    setAppendError: function(message) {
        this.$('#append-error').empty().append(message);
    },
    clearAppendTool: function() {
        this.$('#ok-button').removeAttr('disabled'); //('disabled','false');
        this.$('#append-error').empty();
        delete app.reversePlanOnAppend;
        delete app.prependPlanOnAppend;
    },
    appendPlan: function(data) {
        console.log(data);
        if (data.sequence.length == 0) {
            // no sequence to add
            app.vent.trigger('clearAppendTool');
            return;
        }
        if (app.reversePlanOnAppend)
            data.sequence.reverse();
        if (app.prependPlanOnAppend && !app.reversePlanOnAppend)
            data.sequence.reverse(); // plan is pushed in reverse order when prepending
        delete app.reversePlanOnAppend;
        var method = undefined;
        var sequence = app.currentPlan.get('sequence').models.slice();
        console.log('number of items');
        console.log(data.sequence.length);
        if (app.prependPlanOnAppend) {
            if (sequence.length > 0) {
                console.log('adding connecting segment');
                var segment = app.models.segmentFactory();
                sequence.unshift(segment);
            }
            while (data.sequence.length > 0) {
                console.log('pushing item');
                console.log(data.sequence.length);
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    console.log('Error parsing sequence');
                    break;
                }
                sequence.unshift(model);
                console.log('pushed item');
                console.log(data.sequence.length + ' items left');
                console.log(data.sequence.length > 0);
            }
        } else {
            if (sequence.length > 0) {
                console.log('adding connecting segment');
                var segment = app.models.segmentFactory();
                sequence.push(segment);
            }
            while (data.sequence.length > 0) {
                var item = data.sequence.shift();
                var model = undefined;
                if (item.type == 'Station') {
                    model = app.models.stationFactory(item);
                } else if (item.type == 'Segment') {
                    model = app.models.segmentFactory(item);
                } else {
                    console.log('Error parsing sequence');
                    break;
                }
                console.log('pushing item');
                console.log(data.sequence.length);
                sequence.push(model);
                console.log('pushed item');
                console.log(data.sequence.length + ' items left');
                console.log(data.sequence.length > 0);
            }
        }
        delete app.prependPlanOnAppend;
        app.Actions.disable();
        app.currentPlan.get('sequence').models = sequence;
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('clearAppendTool');
        app.updatePlan(undefined);
        app.Actions.enable();
        app.vent.trigger('change:plan');
    },
    reverseStations: function() {
        app.vent.trigger('plan:reversing');
        app.currentPlan.get('sequence').models.reverse();
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('plan:reverse');
    },
    disableForReadOnly: function() {
        this.$('#btn-reverse').attr('disabled', 'true');
        this.$('#ok-button').attr('disabled', 'true');
    }
});

app.views.PlanLinksView = Backbone.View.extend({
    template: '#template-plan-links',
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
    },
    render: function() {
        this.$el.html(this.template({
            planLinks: app.planLinks
        }));
    }
});

app.views.TabNavView = Backbone.Marionette.LayoutView.extend({
    template: '#template-tabnav',
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.tab-nav li': 'clickSelectTab'
    },

    viewMap: {
        //'meta': app.views.PlanMetaView,
        'meta': app.views.PropertiesForm,
        'sequence': app.views.PlanSequenceView,
        'layers': app.views.FancyTreeView,
        'tools': app.views.PlanToolsView,
        'links': app.views.PlanLinksView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            this.setTab(tabId);
        });
    },

    onRender: function() {
        if (! this.options.initialTab) {
            this.options.initialTab = 'meta';
        }
        if (!_.isUndefined(app.currentTab)) {
            this.trigger('tabSelected', app.currentTab);
        } else {
            this.trigger('tabSelected', this.options.initialTab);
        }
    },

    clickSelectTab: function(event) {
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode);
    },

    setTab: function(tabId) {
        var oldTab = app.currentTab;
        app.currentTab = tabId;
        var $tabList = this.$el.find('ul.tab-nav li');
        $tabList.each(function() {
            li = $(this);
            if (li.data('target') === tabId) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewMap[tabId];
        if (! viewClass) { return undefined; }
//        if (oldTab != "layers"){
//            this.tabContent.close();
//            var view = new viewClass({
//                model: app.currentPlan
//            });
//            this.tabContent.show(view);
//        } else {
//            var view = this.tabContent.currentView;
//            if (!view || view.isClosed){ return; }
//            if (view.close) { view.close(); }
//
//            var newView = new viewClass({
//                model: app.currentPlan
//            });
//
//            this.tabContent.ensureEl();
//
//            newView.render();
//            this.tabContent.open(newView);
//
//            Marionette.triggerMethod.call(newView, "show");
//            Marionette.triggerMethod.call(this.tabContent, "show", newView);
//
//            this.tabContent.currentView = newView;
//        }
        var view = new viewClass({
            model: app.currentPlan
        });
        this.tabContent.show(view);

        app.vent.trigger('tab:change', tabId);
    }

});

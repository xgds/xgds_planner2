app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addStations': function() { app.vent.trigger('mapmode', 'addStations'); this.updateTip('add');},
        'click #btn-save': function() { app.simulatePlan(); app.currentPlan.save() },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-delete': 'deleteSelectedCommands',
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); },
        'click #btn-reverse': 'reverseStations',
        'click #btn-copy': 'copySelectedCommands',
        'click #btn-paste': 'pasteCommands',
        'click #btn-cut': 'cutSelectedCommands',
        'change #gearth-auto-untilt': 'toggleModalUntilt'
    },

    initialize: function() {
        this.cutAfterPaste = false;
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);

        this.listenTo(app.vent, 'change:plan', function(model) {this.updateSaveStatus('change')});
        this.listenTo(app.currentPlan, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo(app.currentPlan, 'error', function(model) {this.updateSaveStatus('error')});
        this.listenTo(app.vent, 'clearSaveStatus', function(model) {this.updateSaveStatus('clear')});
        this.listenTo(app.currentPlan, 'sync', this.refreshSaveAs);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.vent, 'cutAfterPaste', function() { this.cutAfterPaste = true; });
        this.listenTo(app.vent, 'commandsSelected', this.enableCommandActions);
        this.listenTo(app.vent, 'commandsUnSelected', this.disableCommandActions);
        this.listenTo(app.currentPlan, 'change:planVersion', this.handleVersionChange);
        this.listenTo(app.vent, 'earth:loaded', this.fixPlacemarks);

        app.reqres.addHandler('cutAfterPaste', this.getCutAfterPaste, this);
    },

    onShow: function() {
        if (!app.State.mapHeightSet) {
            var offset = this.$el.height() +
                parseFloat(this.$el.parent().css('margin-top')) +
                parseFloat(this.$el.parent().css('margin-bottom')) +
                10; // this exact number is needed because jquery ui uses
            // elements with absolute positionining for the resize handles
            var pageContentElement = $('#page-content');
            var initialHeight = pageContentElement.height() - offset;
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
        if (app.hasHandler('selectedCommands') &&
            !_.isEmpty(app.request('selectedCommands'))) {
            this.enableCommandActions();
        } else {
            this.disableCommandActions();
        }
    },

    getCutAfterPaste: function() {
        if (this.cutAfterPaste) {
            this.cutAfterPaste = false;
            return true;
        }
        return false;
    },

    reverseStations: function() {
        app.vent.trigger('plan:reversing');
        app.currentPlan.get('sequence').models.reverse();
        app.currentPlan.get('sequence').resequence();
        app.vent.trigger('plan:reverse');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'disabled');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'disabled');
    },

    disableCommandActions: function() {
        this.$('#btn-copy').attr('disabled', 'disabled');
        this.$('#btn-paste').attr('disabled', 'disabled');
        this.$('#btn-cut').attr('disabled', 'disabled');
        this.$('#btn-delete').attr('disabled', 'disabled');
    },

    enableCommandActions: function() {
        this.$('#btn-copy').removeAttr('disabled');
        this.$('#btn-paste').removeAttr('disabled');
        this.$('#btn-cut').removeAttr('disabled');
        this.$('#btn-delete').removeAttr('disabled');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { btn.button('toggle'); }
    },

    deleteSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        _.each(commands, function(command) {
            command.collection.remove(command);
            command.destroy();
        });
        app.vent.trigger('change:plan');
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
            if (command.get('pathElement').get('type') == type) {
                sequence.add(command.clone());
            }
            if (cut) {
                command.collection.remove(command);
            }
        });
        app.vent.trigger('change:plan');
    },

    cutSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        app.copiedCommands = new Array();
        app.copiedCommands.push.apply(app.copiedCommands, commands);
        app.request('unselectAllCommands');
        app.vent.trigger('cutAfterPaste');
    },

    updateSaveStatus: function(eventName) {
        var msgMap = {
            'change': 'Unsaved changes.',
            'sync': 'Plan saved.',
            'error': 'Save error.',
            'clear': ''
        };
        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Double click to delete stations, click and drag to move.',
            'add': 'Click to add stations to end.',
            'clear': ''
        };
        var msg = msgMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    toggleModalUntilt: function() {
        app.State.untiltModalEnabled = this.$el.find('#gearth-auto-untilt').prop('checked');
        app.map.untiltMap();
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
        var planIdTemplate = app.planSchema.planIdFormat;
        var context = {
                plan: app.currentPlan.toJSON()
        };
        var planId = planIdTemplate.format(context);
        app.currentPlan.set('id', planId);
        app.currentPlan.get('sequence').resequence();
    },

    fixPlacemarks: function() {
        var $this = this;
        _.defer(function(){
            $this.$('ge').focus();
            app.vent.trigger('plan:fixPlacemarks');
          });
    },

    showSaveAsDialog: function() {
        $('#saveAsName').val(app.currentPlan.attributes['name']);
        var version = app.currentPlan.attributes['planVersion'];
        if (version != '') {
            var newVersion = String.fromCharCode(version.charCodeAt(0) + 1);
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
    template: '#template-command-properties-header'
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

app.views.PlanSequenceView = Backbone.Marionette.Layout.extend({
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
        this.colhead1.close();
        var headerView = new app.views.PlanSequenceHeaderView({
        });
        this.colhead1.show(headerView);
        this.col1.close();
        this.col2.close();
        this.col3.close();
        app.psv = this;
        var sscView = new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        });
        this.col1.show(sscView);
    },

    showStation: function(itemModel) {
        // Clear columns
        this.col3.close();
        this.colhead2.close();
        var headerView = new app.views.StationSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        this.col2.close();

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('sequence')});
        this.col2.show(view);

        //this.showMeta(itemModel);
    },

    showSegment: function(itemModel) {
        this.col3.close();
        this.colhead2.close();
        var headerView = new app.views.SegmentSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        this.col2.close();

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('sequence')});
        this.col2.show(view);

        this.showMeta(itemModel);
    },

    showCommand: function(itemModel) {
        this.colhead3.close();
        var headerView = new app.views.CommandPropertiesHeaderView();
        this.colhead3.show(headerView);
        this.col3.close();
        var view = new app.views.PropertiesForm({model: itemModel, readonly: app.options.readonly});
        this.col3.show(view);
    },

    showMeta: function(model) {
        this.colhead3.close();
        if (model.get('type') == 'Station') {
            var headerView = new app.views.StationPropertiesHeaderView();
        } else if (model.get('type') == 'Segment') {
            var headerView = new app.views.SegmentPropertiesHeaderView();
        } else if (model.get('type') == 'Command') {
            var headerView = new app.views.CommandPropertiesHeaderView();
        }
        this.colhead3.show(headerView);
        this.col3.close();
        app.State.metaExpanded = true;
        app.State.addCommandsExpanded = false;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.PropertiesForm({
            model: model
        }));
    },

    showPresets: function(itemModel) {
        this.colhead3.close();
        var headerView = new app.views.CommandPresetsHeaderView();
        this.colhead3.show(headerView);
        this.col3.close();
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = true;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.CommandPresetsView({
            model: itemModel
        }));
    },

    showNothing: function() {
        // clear the columns
        this.col2.close();
        this.col3.close();
        this.colhead2.close();
        this.colhead3.close();
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
            this.$el.find('i').removeClass('icon-chevron-right');
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
            this.$el.find('i').addClass('icon-chevron-right');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.option = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function() {
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
    itemView: app.views.PathElementItemView,
    itemViewOptions: {
        expandClass: 'col1'
    },
    emptyView: app.views.NoStationsView,

    initialize: function() {
        // re-render on plan save because for some reason, the collection
        // is re-rendered, reversed, on save.
        //app.State.stationSelected is our state variable
        this.listenTo(app.currentPlan, 'sync', this.render);
        this.listenTo(app.vent, 'station:change', this.render);
        this.listenTo(app.vent, 'plan:reverse', this.render);
        this.on('itemview:expand', this.onItemExpand, this);
        //this.on('itemview:render', this.restoreExpanded, this);
    },

    onItemExpand: function(itemView) {
        app.State.stationSelected = itemView.model;
    },

    restoreExpanded: function() {
        if (!_.isUndefined(app.State.stationSelected)) {
            var childView = this.children.findByModel(app.State.stationSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models
                // change on save
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
        return '<input class="select" type="checkbox"/>' + displayName + ' <span class="duration">' + timing + '</span><i/>';
    },
    events: function() {
        return _.extend(app.views.SequenceListItemView.prototype.events, {
            'click input.select': this.toggleSelect
        });
    },
    initialize: function() {
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
    initialize: function() {
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
    itemView: app.views.CommandItemView,
    itemViewContainer: '.command-list',
    itemViewOptions: {
        selectable: true,
        expandClass: 'col2'
    },
    emptyView: app.views.NoCommandsView,
    events: {
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
        app.reqres.addHandler('selectedCommands', this.getSelectedCommands, this);
        app.reqres.addHandler('unselectAllCommands', this.unselectAll, this);
        app.reqres.addHandler('currentPathElement', function() {return this.model;}, this);
        if (_.isUndefined(app.State.metaExpanded))
            app.State.metaExpanded = true;
        if (_.isUndefined(app.State.addCommandsExpanded))
            app.State.addCommandsExpanded = false;
        this.on('itemview:expand', this.onItemExpand, this);
        this.on('itemview:selected', this.onItemSelected, this);
        this.on('itemview:unselected', this.onItemUnSelected, this);
        this.itemsSelected = false;
        //this.on('itemview:render', this.restoreExpanded, this);
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
        this.children.each(function(view) {
            if (view.isSelected()) { commands.push(view.model); }
        });
        return commands;
    },

    getCommandCollection: function() {
        return this.collection;
    },

    unselectAll: function() {
        this.children.each(function(view) {
            view.setUnselected();
        });
    },

    onItemExpand: function(itemView) {
        app.State.commandSelected = itemView.model;
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

    initialize: function() {
        var readonly = this.options.readonly || app.options.readonly;
        var visible = this.options.visible;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || this.options.model.schema;
        this.options.data = this.options.data || this.options.model.data;
        this.Field = Backbone.Form.UnitField;
        this.template = Handlebars.compile($(this.template).html());
        var schema = this.options.schema;

        if (readonly) {
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
        if (_.has(this.fields, '_siteFrame')) {
            if (this.model.changedAttributes(
                {'_siteFrame': this.fields.geometry.editor.siteFrameMode.toString()})) {
                this.fields.geometry.editor.toggleSiteFrame();
            }
        }
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

app.views.LayerTreeView = Backbone.Marionette.ItemView.extend({
    template: '#template-layer-tree',
    onRender: function() {
        app.vent.trigger('layerView:onRender');
        if (!_.isUndefined(ge)) {
            var tree = kmltree({
                url: app.options.layerFeedUrl,
                gex: ge.gex,
                mapElement: $('#map'),
                element: this.$el.find('#layertree'),
                restoreState: true
            });
            tree.load();
        }
    }
});

app.views.PlanToolsView = Backbone.View.extend({
    template: '#template-plan-tools',
    events: {
        'click #ok-button': 'okClicked'
    },
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else
            this.template = Handlebars.compile(source);
        this.listenTo(app.vent, 'clearAppendTool', this.clearAppendTool);
        this.listenTo(app.vent, 'setAppendError', this.setAppendError);
    },
    render: function() {
        this.$el.html(this.template({
            planIndex: app.planIndex
        }));
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
        this.$('#ok-button').attr('disabled', 'disabled');
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
        this.$('#ok-button').removeAttr('disabled');
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
    }
});

app.views.PlanLinksView = Backbone.View.extend({
    template: '#template-plan-links',
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source))
            this.template = function() {
                return '';
            };
        else
            this.template = Handlebars.compile(source);
    },
    render: function() {
        this.$el.html(this.template({
            planLinks: app.planLinks
        }));
    }
});

app.views.TabNavView = Backbone.Marionette.Layout.extend({
    template: '#template-tabnav',
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.nav-tabs li': 'clickSelectTab'
    },

    viewMap: {
        //'meta': app.views.PlanMetaView,
        'meta': app.views.PropertiesForm,
        'sequence': app.views.PlanSequenceView,
        'layers': app.views.LayerTreeView,
        'tools': app.views.PlanToolsView,
        'links': app.views.PlanLinksView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        // load layer tree ahead of time to load layers into map
        app.tree = null;
        this.listenTo(app.vent, 'earth:loaded', function() {
            app.tree = kmltree({
                url: app.options.layerFeedUrl,
                gex: ge.gex,
                mapElement: [],
                element: [],
                restoreState: true,
                bustCache: true
            });
            app.tree.load();
        });
        this.listenTo(app.vent, 'layerView:onRender', function() {
            // remove tree once user loads layers tab
            if (!_.isNull(app.tree)) {
                // only remove if it's there in the first place
                app.tree.destroy();
            }
        });
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
        app.currentTab = tabId;
        var $tabList = this.$el.find('ul.nav-tabs li');
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
        this.tabContent.close();
        var view = new viewClass({
            model: app.currentPlan
        });
        this.tabContent.show(view);

        app.vent.trigger('tab:change', tabId);
    }

});

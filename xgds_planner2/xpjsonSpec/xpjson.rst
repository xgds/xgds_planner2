
=======================================================
The Exploration Plan JSON (XPJSON) Format Specification
=======================================================

Authors
  | Trey Smith (Carnegie Mellon University)
  | Tamar Cohen (NASA Ames Research Center)
  | David Lees (Carnegie Mellon University)
  | Ted Scharff (NASA Ames Research Center)

Revision
  0.2

Date
  TBD

Canonical URL of this document
  TBD

Further information
  TBD

.. contents::
   :depth: 2

.. sectnum::

Introduction
============

Exploration Plan JSON (XPJSON) is a format for specifying a
single-timeline command sequence. XPJSON plans typically include
position and time information (actions with spatial coordinates,
modeling duration of activities).

Altogether, the XPJSON specification defines formats for three companion
document types:

 * Plan_: A plan is a command sequence and associated meta-data.

 * PlanSchema_. A plan schema defines available commands and their
   semantics, defines parameter types, and includes styling information
   that controls how the plan is displayed in a planning
   interface. Every Plan_ conforms to a PlanSchema_.

 * PlanLibrary_. A plan library is a library of reusable commands,
   sites, platforms, and stations that the user can draw from when
   creating a Plan_. Together, the PlanSchema_ and a PlanLibrary_ whose
   elements conform to the schema make up the configuration of the
   planning interface.

Examples
========

An XPJSON Plan_::

  {
    "xpjson": "0.2",
    "type": "Plan",

    "name": "Marscape Traverse",
    "notes": "A simple drive",
    "planNumber": 1,
    "planVersion": "A",
    "id": "ARC_R001A",

    "creator": "John Doe",
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    "schemaUrl": "http://example.com/robotScienceSchema.json",
    "libraryUrls": [
      "http://example.com/robotScienceLibrary.json"
    ],

    "site": {
      "type": "Site",
      "name": "NASA Ames Marscape",
      "id": "ARC",
      "crs": {
        "type": "name",
        "properties": {
          "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
        }
      }
    },

    "platform": {
      "type": "Platform",
      "name": "K10 Red",
      "id": "R"
    },

    "sequence": [
      {
        "type": "Station",
        "name": "Rover Staging Area",
        "id": "00",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065483, 37.416433]
        }
      },
      {
        "type": "Segment",
        "id": "01",
        "tolerance": 0.5,
        "speed": 0.3,
        "sequence": [
          {
            "type": "PeriodicPancam",
            "id": "01_0_SPP",
            "presetCode": "SPP",
            "whiteBalance": "A",
            "focalLengthMm": 7.4,
            "intervalSeconds": 5
          }
        ]
      },
      {
        "type": "Station",
        "name": "Waypoint 1",
        "id": "02",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065585, 37.416379]
        },
        "sequence": [
          {
            "type": "MicroImage",
            "id": "02_0_MI",
            "presetCode": "MI",
            "whiteBalance": "A",
            "focalLengthMm": 10.1
          }
        ]
      },
      {
        "type": "Segment",
        "id": "03",
        "tolerance": 1.0,
        "speed": 0.7
      },
      {
        "type": "Station",
        "name": "Waypoint 2",
        "id": "04",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065639,  37.416503]
        }
      }
    ]
  }

The PlanSchema_ that the Plan_ conforms to::

  {
    "xpjson": "0.2",
    "type": "PlanSchema",

    "name": "Robot Science Schema",
    "notes": "Define available robot science commands",
    "id": "http://example.com/robotScienceSchema.json",

    "planIdFormat": "{plan.site.id}_{plan.planNumber:03d}{plan.planVersion}",
    "stationIdFormat": "STN{stationIndex:02d}",
    "segmentIdFormat": "SEG{stationIndex:02d}",
    "commandIdFormat": "{parent.id}_{commandIndex:1d}_{command.presetCode}",

    "segmentParams": [
      {
        "type": "ParamSpec",
        "id": "speed",
        "name": "speed (m/s)",
        "valueType": "number",
        "minimum": 0,
        "default": 0.4,
        "notes": "Estimated mean speed of drive (m/s)"
      },
      {
        "type": "ParamSpec",
        "id": "tolerance",
        "name": "tolerance (m)",
        "valueType": "number",
        "minimum": 0,
        "default": 1.0,
        "notes": "How close we need to get to the target coordinates (meters)"
      }
    ],

    "paramSpecs": [
      {
        "type": "ParamSpec",
        "id": "duration",
        "valueType": "number",
        "minimum": 0,
        "notes": "Estimated time required to execute command (minutes)",
        "required": false
      }
    ],

    "commandSpecs": [
      {
        "type": "CommandSpec",
        "id": "CommandWithDuration",
        "parent": "Command",
        "abstract": true,
        "params": [
          {
            "type": "ParamSpec",
            "id": "duration",
            "parent": "duration"
          },
          {
            "type": "ParamSpec",
            "id": "presetCode",
            "valueType": "string",
            "notes": "Identifier for the command preset in the PlanLibrary, included in id field of commands"
          }
        ]
      },
      {
        "type": "CommandSpec",
        "id": "Image",
        "parent": "CommandWithDuration",
        "abstract": true,
        "params": [
          {
            "type": "ParamSpec",
            "id": "whiteBalance",
            "name": "White balance",
            "valueType": "string",
            "choices": [
              ["A", "Auto"],
              ["D", "Daylight"],
              ["C", "Cloudy"]
            ],
            "notes": "White balance setting for camera; auto is usually ok"
          },
          {
            "type": "ParamSpec",
            "id": "focalLengthMm",
            "name": "Focal length (mm)",
            "valueType": "number",
            "minimum": 7.4,
            "maximum": 44,
            "notes": "Actual (not 35 mm-equivalent) focal length of camera."
          }
        ]
      },
      {
        "type": "CommandSpec",
        "id": "MicroImage",
        "parent": "Image",
        "params": [
          {
            "type": "ParamSpec",
            "id": "duration",
            "parent": "duration",
            "default": 0.1
          }
        ]
      },
      {
        "type": "CommandSpec",
        "id": "PeriodicPancam",
        "parent": "Image",
        "blocking": false,
        "params": [
          {
            "type": "ParamSpec",
            "id": "intervalSeconds",
            "name": "Interval between images (seconds)",
            "valueType": "number",
            "minimum": 2
          }
        ]
      }
    ],

    "planSequenceCommands": [],

    "stationSequenceCommands": [
      "MicroImage"
    ],

    "segmentSequenceCommands": [
      "PeriodicPancam"
    ]
  }

A PlanLibrary_ providing reusable elements that were incorporated into
the plan::

  {
    "xpjson": "0.2",
    "type": "PlanLibrary",

    "name": "Robot Science Library",
    "notes": "Reusable elements for robot driving plans",
    "id": "http://example.com/robotScienceLibrary.json",
    "schemaUrl": "http://example.com/robotScienceSchema.json",

    "sites": [
      {
        "type": "Site",
        "name": "NASA Ames Marscape",
        "id": "ARC",
        "crs": {
          "type": "name",
          "properties": {
            "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
          }
        }
      }
    ],

    "platforms": [
      {
        "type": "Platform",
        "name": "K10 Red",
        "id": "R"
      }
    ],

    "stations": [
      {
        "type": "Station",
        "id": "RoverStagingArea",
        "geometry": {
          "type": "Point",
          "coordinates": [-122.065483, 37.416433]
        }
      }
    ],

    "commands": [
      {
        "type": "PeriodicPancam",
        "name": "FastPeriodicPancam",
        "presetCode": "FPP",
        "whiteBalance": "A",
        "focalLengthMm": 7.4,
        "intervalSeconds": 2
      },
      {
        "type": "PeriodicPancam",
        "name": "SlowPeriodicPancam",
        "presetCode": "SPP",
        "whiteBalance": "A",
        "focalLengthMm": 7.4,
        "intervalSeconds": 5
      }
    ]
  }

Definitions
===========

 * The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
   "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this
   document are to be interpreted as described in `IETF RFC 2119`_.

 * JavaScript Object Notation (JSON), and the terms "object", "name", "value",
   "array", and "number", are defined in `IETF RFC 4627`_.  XPJSON
   documents have the standard JSON MIME type, "application/json".

 * `GeoJSON 2008`_ is a dialect of JSON used for geospatial data
   interchange.  Although the 2008 version has been superseded by `IETF
   RFC 7946`_, XPJSON references the older version because XPJSON users
   rely on its capability to specify coordinate reference systems other
   than WGS84.

.. _IETF RFC 2119: http://www.ietf.org/rfc/rfc2119.txt
.. _IETF RFC 4627: http://www.ietf.org/rfc/rfc4627.txt
.. _GeoJSON 2008: http://geojson.org/geojson-spec.html
.. _IETF RFC 7946: https://tools.ietf.org/html/rfc7946

Class Hierarchy
===============

The JavaScript objects that make up XPJSON documents fit into a class
hierarchy as follows:

 * Dictionary

 * TypedObject_

   * ClassSpec_

     * CommandSpec_

   * Command_

     * `Command Subclasses`_ (as defined by the schema)

   * Document_

     * Plan_

     * PlanLibrary_

     * PlanSchema_

   * ParamSpec_

   * PathElement_

     * Segment_

     * Station_

   * Platform_

   * Site_

   * Target_

JavaScript objects are collections of name/value pairs where the names
are strings.

In a Dictionary instance, the names in the name/value pairs are
arbitrary. When we say a "Dictionary of X" we mean a Dictionary where
all the values are instances of the same type X (or subclasses of X).

Subclasses of TypedObject_ have named members with pre-defined meanings.

.. _TypedObject:

TypedObject Class
~~~~~~~~~~~~~~~~~

A TypedObject instance has a ``type`` member that states which class it
belongs to. The definition of that class specifies the name, type, and
interpretation of other members.

Abstract class:
  Yes

Inherits from:
  (none)

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``type``          |string          |optional         |The name of the class this object   |
|                  |                |                 |belongs to.                         |
+------------------+----------------+-----------------+------------------------------------+
|``name``          |string          |optional         |Name. If the object is exposed to   |
|                  |                |                 |the user in the planning interface, |
|                  |                |                 |this is generally the text label the|
|                  |                |                 |user sees.                          |
+------------------+----------------+-----------------+------------------------------------+
|``notes``         |string          |optional         |Free-form notes about the object.   |
|                  |                |                 |                                    |
|                  |                |                 |Notes about objects in the          |
|                  |                |                 |PlanSchema_ and PlanLibrary_ may be |
|                  |                |                 |displayed as explanatory text in the|
|                  |                |                 |planning interface.                 |
|                  |                |                 |                                    |
|                  |                |                 |Users of the planning interface     |
|                  |                |                 |should be able to attach notes to   |
|                  |                |                 |the objects they edit in the Plan_  |
|                  |                |                 |(including Stations, Segments,      |
|                  |                |                 |Targets, Commands, and the Plan     |
|                  |                |                 |itself).                            |
+------------------+----------------+-----------------+------------------------------------+
|``id``            |string          |optional         |Identifier.                         |
|                  |                |                 |                                    |
|                  |                |                 |In some applications, the ``id`` is |
|                  |                |                 |part of a formal naming convention. |
|                  |                |                 |For example, the ``id`` of a command|
|                  |                |                 |might include ids from the site, the|
|                  |                |                 |plan, and the station that it is    |
|                  |                |                 |part of. Note that, depending on the|
|                  |                |                 |naming convention, the id of an     |
|                  |                |                 |object might automatically change if|
|                  |                |                 |the sequence that contains it is    |
|                  |                |                 |reordered.                          |
|                  |                |                 |                                    |
|                  |                |                 |For PlanSchema_ and PlanLibrary_    |
|                  |                |                 |documents, we suggest using the     |
|                  |                |                 |canonical URL of the document as the|
|                  |                |                 |``id``.                             |
+------------------+----------------+-----------------+------------------------------------+
|``uuid``          |string          |optional         |Universally unique identifier for   |
|                  |                |                 |the given object.                   |
|                  |                |                 |                                    |
|                  |                |                 |In contrast to the ``id`` value, the|
|                  |                |                 |``uuid`` value must persist when the|
|                  |                |                 |object is edited or the sequence    |
|                  |                |                 |that contains it is reordered. The  |
|                  |                |                 |``uuid`` field was created in order |
|                  |                |                 |to provide this persistence,        |
|                  |                |                 |especially to maintain object       |
|                  |                |                 |identity when exchanging plans      |
|                  |                |                 |between different planning systems. |
|                  |                |                 |                                    |
|                  |                |                 |If an object is copied, the copy    |
|                  |                |                 |must be assigned a new UUID to      |
|                  |                |                 |maintain uniqueness.                |
|                  |                |                 |                                    |
|                  |                |                 |For simplicity, we recommend using a|
|                  |                |                 |Version 4 (randomly generated) UUID.|
+------------------+----------------+-----------------+------------------------------------+
|``derivedInfo``   |object          |optional         |A place to put unstructured         |
|                  |                |                 |"derived" information about objects |
|                  |                |                 |in the plan.                        |
|                  |                |                 |                                    |
|                  |                |                 |Its primary purpose is for          |
|                  |                |                 |exchanging extra information between|
|                  |                |                 |different planning systems. For     |
|                  |                |                 |example, if system A has a model for|
|                  |                |                 |calculating expected duration of    |
|                  |                |                 |travel along a Segment_, it can     |
|                  |                |                 |store the model results in the      |
|                  |                |                 |``derivedInfo`` field of each       |
|                  |                |                 |Segment at plan export, making them |
|                  |                |                 |available to system B.              |
|                  |                |                 |                                    |
|                  |                |                 |This field should only store        |
|                  |                |                 |"non-precious" information about the|
|                  |                |                 |plan that was calculated by a       |
|                  |                |                 |planning tool rather than entered by|
|                  |                |                 |a user, and that can be regenerated |
|                  |                |                 |from other fields if needed.        |
|                  |                |                 |                                    |
|                  |                |                 |Its value is an unstructured object,|
|                  |                |                 |i.e., its contents are not described|
|                  |                |                 |in the PlanSchema_. As a result,    |
|                  |                |                 |planning interfaces may not support |
|                  |                |                 |user inspection or editing of the   |
|                  |                |                 |contents.                           |
+------------------+----------------+-----------------+------------------------------------+

.. _ClassSpec:

ClassSpec Class
~~~~~~~~~~~~~~~~~

A ClassSpec instance appears in a PlanSchema_ and defines a class for
use in plans that conform to the schema.

The ``name`` value of the ClassSpec_ is used as the ``type`` value of
instances of the class in the Plan_.

Abstract class:
  Yes

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``name``          |string          |optional         |The text label to use in the        |
|                  |                |                 |planning interface when referring to|
|                  |                |                 |this class.                         |
|                  |                |                 |                                    |
|                  |                |                 |If not specified, the ``name``      |
|                  |                |                 |defaults to a prettified version of |
|                  |                |                 |the ``id`` (e.g. insert spaces on   |
|                  |                |                 |word boundaries in the the          |
|                  |                |                 |CamelCaseClassName, or other        |
|                  |                |                 |formatting as appropriate).         |
+------------------+----------------+-----------------+------------------------------------+
|``id``            |string          |required         |The CamelCaseClassName for this     |
|                  |                |                 |class.                              |
|                  |                |                 |                                    |
|                  |                |                 |If this class in the plan schema has|
|                  |                |                 |a corresponding implementation as a |
|                  |                |                 |Java class or an IDL message        |
|                  |                |                 |definition, the ``id`` likely       |
|                  |                |                 |matches the class name on those     |
|                  |                |                 |platforms.                          |
+------------------+----------------+-----------------+------------------------------------+
|``parent``        |string          |optional         |The ``id`` of a parent ClassSpec_   |
|                  |                |                 |from which this ClassSpec_ inherits |
|                  |                |                 |members.                            |
|                  |                |                 |                                    |
|                  |                |                 |The ``id``, ``name``, and           |
|                  |                |                 |``abstract`` members are not        |
|                  |                |                 |inherited.                          |
|                  |                |                 |                                    |
|                  |                |                 |For members with composite value    |
|                  |                |                 |types (arrays or Dictionaries),     |
|                  |                |                 |inheritance has "union"             |
|                  |                |                 |semantics. Entries specified in the |
|                  |                |                 |child ClassSpec_ are appended to    |
|                  |                |                 |those specified in the parent       |
|                  |                |                 |ClassSpec_.                         |
+------------------+----------------+-----------------+------------------------------------+
|``abstract``      |boolean         |``true``         |This ClassSpec_ describes an        |
|                  |                |                 |abstract class. Instances should not|
|                  |                |                 |appear in an actual Plan_ and should|
|                  |                |                 |not be available as a choice in the |
|                  |                |                 |planning interface. It serves only  |
|                  |                |                 |as a parent for other ClassSpecs.   |
|                  |                +-----------------+------------------------------------+
|                  |                |``false``        |This ClassSpec_ is concrete and     |
|                  |                |(default)        |instances may appear in a Plan_.    |
+------------------+----------------+-----------------+------------------------------------+
|``params``        |array of        |optional         |Parameters defined for this class.  |
|                  |ParamSpec_      |                 |                                    |
+------------------+----------------+-----------------+------------------------------------+

.. _Command:

Command Class
~~~~~~~~~~~~~

A Command instance is an element of an XPJSON command sequence.

Abstract class:
  Yes

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``name``           |string          |optional         |The text label to use in the        |
|                   |                |                 |planning interface for this command.|
|                   |                |                 |                                    |
|                   |                |                 |If not specified, defaults to a     |
|                   |                |                 |prettified version of the ``id``    |
|                   |                |                 |member. What it means to "prettify" |
|                   |                |                 |the ``id`` really depends on the    |
|                   |                |                 |format of the ``id``, which varies  |
|                   |                |                 |from application to application. For|
|                   |                |                 |example, the ``id`` might be        |
|                   |                |                 |shortened for display by removing a |
|                   |                |                 |common prefix that appears in all   |
|                   |                |                 |commands belonging to a particular  |
|                   |                |                 |plan.                               |
+-------------------+----------------+-----------------+------------------------------------+
|``id``             |string          |required         |Identifier for the command.         |
|                   |                |                 |                                    |
|                   |                |                 |Probably auto-generated by the      |
|                   |                |                 |planning interface according to a   |
|                   |                |                 |naming convention.                  |
+-------------------+----------------+-----------------+------------------------------------+
|``uuid``           |string          |required         |Persistent universally unique       |
|                   |                |                 |identifier for the command.         |
|                   |                |                 |                                    |
|                   |                |                 |Typically a Version 4 UUID randomly |
|                   |                |                 |generated by the planning interface.|
+-------------------+----------------+-----------------+------------------------------------+
|``stopCommandUuid``|string          |optional         |Identifies an earlier non-blocking  |
|                   |                |                 |command to stop by its ``uuid``.    |
|                   |                |                 |                                    |
|                   |                |                 |Used only if ``isStopCommand`` is   |
|                   |                |                 |``true`` for this command subclass. |
+-------------------+----------------+-----------------+------------------------------------+
|``stopCommandType``|string          |optional         |Identifies an earlier non-blocking  |
|                   |                |                 |command to stop by its ``type``.    |
|                   |                |                 |                                    |
|                   |                |                 |Used only if ``isStopCommand`` is   |
|                   |                |                 |``true`` for this command subclass. |
+-------------------+----------------+-----------------+------------------------------------+

Command Subclasses
~~~~~~~~~~~~~~~~~~

Each CommandSpec_ object in the PlanSchema_ defines a new subclass of
the Command_ class. Instances of these subclasses may appear in the
``sequence`` member of a Plan_, Station_, or Segment_ object.

The subclasses are arranged in their own class hierarchy, with
inheritance relationships specified by the ``parent`` member. Abstract
subclasses exist only to act as parents of other classes and must not be
used in a Plan_.

The PlanSchema_ designer can control how much flexibility is offered in
the planning interface. There are several possible conventions for a
schema:

 * Maximum flexibility: Allow users to set arbitrary values for
   parameters.  (These values can be limited to fall within a certain
   range via the ``minimum`` and ``maximum`` members.)

 * Per-parameter choices: Restrict users to a limited range of choices
   for each parameter using the ``choices`` member.

 * Command presets: Sometimes we want to pre-define a collection of presets
   for a command, where each preset sets most or all of the parameter
   values for the command. Restricting users to choose from among these
   presets has some advantages in terms of allowing the schema
   designer to choose descriptive names for the presets ("wide low-res
   panorama", "narrow high-res panorama"), and allowing each preset to
   be thoroughly tested before deployment, for example to empirically
   measure the average time it takes to execute. To use presets:

   * Place the presets in the ``commands`` section of the
     PlanLibrary_.

   * Once the user has chosen a preset in the planning interface, their
     ability to further edit the parameter values set by the preset is
     controlled by the ``editable`` member of each ParamSpec_, so the
     plan schema designer can choose how much flexibility to grant the
     user.

Example
-------

Example instance of a "DriveForward" subclass::

  {
    // inherited from TypedObject
    "type": "DriveForward",
    "name": "Drive 1",
    "notes": "-",
    "id": "ARC_R001A00_0_FWD",
    "uuid": "46b5a8f5-d5bd-4fe8-a493-99c29d088bce",

    // inherited from Command
    "stationId": "ARC_R001A00",

    // defined in DriveForward CommandSpec
    "distance": 0.5,
    "speed": 0.1
  }

The instance conforms to this CommandSpec_ in the PlanSchema_::

  {
    "type": "CommandSpec",
    "name": "DriveForward",
    "id": "FWD",
    "notes": "Drive forward",
    "parent": "Command",
    "params": [
      {
        "type": "ParamSpec",
        "id": "distance",
        "name": "distance (meters)",
        "valueType": "number"
      },
      {
        "type": "ParamSpec",
        "id": "speed",
        "name": "speed (m/s)",
        "valueType": "number"
      }
    ]
  }

.. _CommandSpec:

CommandSpec Class
~~~~~~~~~~~~~~~~~

A CommandSpec instance defines a command type that can be included in a Plan_.

Abstract class:
  No

Inherits from:
  ClassSpec

+--------------------+----------------+-----------------+-------------------------------------+
|Member              |Type            |Values           |Meaning                              |
+====================+================+=================+=====================================+
|``blocking``        |boolean         |``true``         |This command is blocking. Blocking   |
|                    |                |(default)        |commands have their own termination  |
|                    |                |                 |conditions and run until those       |
|                    |                |                 |conditions are satisfied. The next   |
|                    |                |                 |command should be executed after     |
|                    |                |                 |this command completes.              |
|                    |                +-----------------+-------------------------------------+
|                    |                |``false``        |This command is                      |
|                    |                |                 |non-blocking. Non-blocking commands  |
|                    |                |                 |generally do not terminate on their  |
|                    |                |                 |own. The executive should terminate  |
|                    |                |                 |this command in either of two cases: |
|                    |                |                 |                                     |
|                    |                |                 | * When it reaches an explicit       |
|                    |                |                 |   stop command that references this |
|                    |                |                 |   command.                          |
|                    |                |                 |                                     |
|                    |                |                 | * When it reaches the end of the    |
|                    |                |                 |   ``sequence`` member containing    |
|                    |                |                 |   this command, if                  |
|                    |                |                 |   ``scopeTerminate`` is ``true``.   |
|                    |                |                 |                                     |
|                    |                |                 |The next command should be executed  |
|                    |                |                 |immediately after this command is    |
|                    |                |                 |executed, without waiting for this   |
|                    |                |                 |command to complete.                 |
+--------------------+----------------+-----------------+-------------------------------------+
|``isStopCommand``   |boolean         |optional (default|If true, each instance of this       |
|                    |                |``false``)       |command has the effect of stopping an|
|                    |                |                 |earlier non-blocking command         |
|                    |                |                 |specified in the ``stopCommandUuid`` |
|                    |                |                 |and ``stopCommandType`` fields.      |
+--------------------+----------------+-----------------+-------------------------------------+
|``scopeTerminate``  |boolean         |optional (default|(Non-blocking commands only.)  The   |
|                    |                |``true``)        |executive should automatically       |
|                    |                |                 |terminate this command when it       |
|                    |                |                 |reaches the end of its scope, that   |
|                    |                |                 |is, the end of the ``sequence``      |
|                    |                |                 |member containing the command.       |
+--------------------+----------------+-----------------+-------------------------------------+
|``color``           |string          |optional         |The color to use to distinguish this |
|                    |                |                 |command type in the planning         |
|                    |                |                 |interface (for example, when an      |
|                    |                |                 |instance of the command appears in a |
|                    |                |                 |timeline).                           |
|                    |                |                 |                                     |
|                    |                |                 |Format: HTML-style ``"#rrggbb"``.    |
+--------------------+----------------+-----------------+-------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "CommandSpec",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from ClassSpec
    "parent": "(parent CommandSpec id)",
    "abstract": false,
    "params": [
      { (ParamSpec 1) },
      ...
    ]

    // defined in CommandSpec
    "blocking": true,
    "isStopCommand": false,
    "scopeTerminate": true,
    "color": "#ff0000"
  }

.. _Document:

Document Class
~~~~~~~~~~~~~~

Document is the parent class for top-level document nodes in XPJSON
Plan_, PlanSchema_, and PlanLibrary_ documents.

Abstract class:
  Yes

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``xpjson``        |string          |"0.2"            |Indicates this is an XPJSON document|
|                  |                |                 |(a Plan_, PlanSchema_, or           |
|                  |                |                 |PlanLibrary_). Specifies what       |
|                  |                |                 |version of the XPJSON spec the      |
|                  |                |                 |document conforms to.               |
+------------------+----------------+-----------------+------------------------------------+
|``subject``       |array of string |optional         |Subjects covered by the             |
|                  |                |                 |document. These are probably        |
|                  |                |                 |user-defined tags.                  |
+------------------+----------------+-----------------+------------------------------------+
|``creator``       |string          |optional         |The entity primarily responsible for|
|                  |                |                 |creating the document.              |
+------------------+----------------+-----------------+------------------------------------+
|``contributors``  |array of string |optional         |Other entities that contributed to  |
|                  |                |                 |the document.                       |
+------------------+----------------+-----------------+------------------------------------+
|``dateCreated``   |date-time       |optional         |The time when the document was      |
|                  |                |                 |created.                            |
+------------------+----------------+-----------------+------------------------------------+
|``dateModified``  |date-time       |optional         |The time when the document was last |
|                  |                |                 |modified.                           |
+------------------+----------------+-----------------+------------------------------------+

.. _ParamSpec:

ParamSpec Class
~~~~~~~~~~~~~~~

A ParamSpec instance defines the properties of a command parameter.

Abstract class:
  No

Inherits from:
  TypedObject

+------------------+----------------+------------------------+------------------------------------+
|Member            |Type            |Values                  |Meaning                             |
+==================+================+========================+====================================+
|``parent``        |string          |optional                |The ``id`` of ParamSpec_ in the     |
|                  |                |                        |``paramSpecs`` section of the       |
|                  |                |                        |PlanSchema_, from which this        |
|                  |                |                        |ParamSpec_ inherits members.        |
|                  |                |                        |                                    |
|                  |                |                        |The ``id`` member is not inherited. |
|                  |                |                        |                                    |
+------------------+----------------+------------------------+------------------------------------+
|``valueType``     |string          |``"string"``            |Parameter has string value.         |
|                  |                +------------------------+------------------------------------+
|                  |                |``"integer"``           |Parameter has integer value.        |
|                  |                +------------------------+------------------------------------+
|                  |                |``"number"``            |Parameter has numerical (floating   |
|                  |                |                        |point) value.                       |
|                  |                +------------------------+------------------------------------+
|                  |                |``"boolean"``           |Parameter has boolean value.        |
|                  |                +------------------------+------------------------------------+
|                  |                |``"Point"``,            |Parameter value is a `GeoJSON 2008  |
|                  |                |``"MultiPoint"``,       |geometry`_ object whose ``type``    |
|                  |                |``"LineString"``,       |field is set to the specified value,|
|                  |                |``"MultiLineString"``,  |with coordinates that make sense in |
|                  |                |``"Polygon"``,          |the CRS for the Site_.              |
|                  |                |``"MultiPolygon"``, or  |                                    |
|                  |                |``"GeometryCollection"``|In principle, a planning interface  |
|                  |                |                        |could support editing parameters    |
|                  |                |                        |whose ``valueType`` is any of these |
|                  |                |                        |geometry types. In practice, the    |
|                  |                |                        |interface will probably only support|
|                  |                |                        |a subset of geometry types (or none)|
|                  |                |                        |and the schema designer will need to|
|                  |                |                        |choose from among that subset.      |
|                  |                +------------------------+------------------------------------+
|                  |                |``"date-time"``         |A date and time.                    |
|                  |                |                        |                                    |
|                  |                |                        |Specified as a string in the format |
|                  |                |                        |``yyyy-mm-ddTHH:MM:SSZ``. The time  |
|                  |                |                        |zone must be UTC and must be        |
|                  |                |                        |specified explicitly (using the     |
|                  |                |                        |``Z`` character). This format is one|
|                  |                |                        |of the formats described in `ISO    |
|                  |                |                        |8601`_, and has the same semantics  |
|                  |                |                        |specified there.  To ensure strict  |
|                  |                |                        |compatibility between planning      |
|                  |                |                        |systems, other formats defined by   |
|                  |                |                        |ISO 8601 must not be used.          |
|                  |                |                        |                                    |
|                  |                |                        |To ensure consistency when          |
|                  |                |                        |exchanging plans, all planning      |
|                  |                |                        |systems should use timestamps and   |
|                  |                |                        |duration calculations with          |
|                  |                |                        |resolution of 1 second (not         |
|                  |                |                        |fractional seconds).                |
|                  |                +------------------------+------------------------------------+
|                  |                |``"targetId"``          |Parameter is a string referring to  |
|                  |                |                        |the id of one of the targets found  |
|                  |                |                        |in the ``targets`` member of the    |
|                  |                |                        |Plan.                               |
|                  |                |                        |                                    |
|                  |                |                        |If the planning interface supports  |
|                  |                |                        |this ``valueType``, it may provide a|
|                  |                |                        |menu for the user to select a Target|
|                  |                |                        |and may draw a link in the map      |
|                  |                |                        |between the location of the referrer|
|                  |                |                        |and the location of the Target.     |
+------------------+----------------+------------------------+------------------------------------+
|``unit``          |string          |optional                |The (plural) name of the physical   |
|                  |                |                        |unit associated with the            |
|                  |                |                        |parameter. Example: ``"meters"``.   |
|                  |                |                        |                                    |
|                  |                |                        |If this unit appears in a UnitSpec_ |
|                  |                |                        |of the PlanSchema_, the planning    |
|                  |                |                        |interface may offer alternative     |
|                  |                |                        |comparable units to the user. But   |
|                  |                |                        |the parameter value stored in the   |
|                  |                |                        |Plan_ must be in terms of this unit.|
+------------------+----------------+------------------------+------------------------------------+
|``minimum``       |``valueType``   |optional                |Minimum legal value for parameter   |
|                  |                |                        |(parameter must have integer or     |
|                  |                |                        |number type).                       |
+------------------+----------------+------------------------+------------------------------------+
|``strictMinimum`` |boolean         |``true``                |Interpret the ``minimum`` field as a|
|                  |                |                        |strictly-greater-than constraint.   |
|                  |                +------------------------+------------------------------------+
|                  |                |``false`` (default)     |Interpret the ``minimum`` field as a|
|                  |                |                        |greater-than-or-equal-to constraint.|
+------------------+----------------+------------------------+------------------------------------+
|``maximum``       |``valueType``   |optional                |Maximum legal value for parameter.  |
+------------------+----------------+------------------------+------------------------------------+
|``strictMaximum`` |boolean         |``true``                |Interpret the ``maximum`` field as a|
|                  |                |                        |strictly-less-than constraint.      |
|                  |                +------------------------+------------------------------------+
|                  |                |``false`` (default)     |Interpret the ``maximum`` field as a|
|                  |                |                        |less-than-or-equal-to constraint.   |
+------------------+----------------+------------------------+------------------------------------+
|``maxLength``     |integer         |optional                |If ``valueType`` is ``"string"``,   |
|                  |                |                        |you can specify the maximum allowed |
|                  |                |                        |string length.                      |
+------------------+----------------+------------------------+------------------------------------+
|``choices``       |array of        |optional                |If specified, the parameter value   |
|                  |[``valueType``, |                        |must be set to one of these choices.|
|                  |string] pairs   |                        |Each choice is a pair whose first   |
|                  |                |                        |element is a possible value for the |
|                  |                |                        |parameter and whose second value is |
|                  |                |                        |a text label used to describe the   |
|                  |                |                        |choice to a user of the planning    |
|                  |                |                        |interface.                          |
+------------------+----------------+------------------------+------------------------------------+
|``widget``        |string          |optional                |The form input widget to display for|
|                  |                |                        |user data entry of the parameter,   |
|                  |                |                        |specified as a name from the HTML   |
|                  |                |                        |forms specification, in all         |
|                  |                |                        |lowercase. Examples: ``"textarea"``,|
|                  |                |                        |``"select"``, ``"radio"``.          |
|                  |                |                        |                                    |
|                  |                |                        |Each planning interface will have   |
|                  |                |                        |its own algorithm for choosing a    |
|                  |                |                        |default widget to use for parameter |
|                  |                |                        |data entry based on its             |
|                  |                |                        |``valueType`` and other             |
|                  |                |                        |properties. The ``widget`` parameter|
|                  |                |                        |overrides that default.             |
|                  |                |                        |                                    |
|                  |                |                        |Planning interfaces may choose which|
|                  |                |                        |widgets to support for each         |
|                  |                |                        |``valueType`` and should ignore the |
|                  |                |                        |``widget`` member if they do not    |
|                  |                |                        |know how to render the specified    |
|                  |                |                        |widget.                             |
|                  |                |                        |                                    |
|                  |                |                        |Note that planning interfaces not   |
|                  |                |                        |based on HTML can support this      |
|                  |                |                        |feature by selecting the widget in  |
|                  |                |                        |their UI toolkit that best matches  |
|                  |                |                        |the specified HTML widget.          |
+------------------+----------------+------------------------+------------------------------------+
|``default``       |``valueType`` or|optional                |The default value of the            |
|                  |``null``        |                        |parameter. If not specified, the    |
|                  |                |                        |default value is ``null``.          |
+------------------+----------------+------------------------+------------------------------------+
|``required``      |boolean         |``true``                |The parameter must be specified.    |
|                  |                |(default)               |                                    |
|                  |                +------------------------+------------------------------------+
|                  |                |``false``               |The parameter is optional.          |
+------------------+----------------+------------------------+------------------------------------+
|``visible``       |boolean         |``true``                |Display the parameter in the detail |
|                  |                |(default)               |view for the command.               |
|                  |                +------------------------+------------------------------------+
|                  |                |``false``               |Hide the parameter                  |
+------------------+----------------+------------------------+------------------------------------+
|``editable``      |boolean         |``true``                |Allow the user to edit the          |
|                  |                |(default)               |parameter.                          |
|                  |                +------------------------+------------------------------------+
|                  |                |``false``               |Don't allow editing.                |
+------------------+----------------+------------------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "ParamSpec",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in ParamSpec
    "parent": "(parent ParamSpec id)",
    "valueType": "(type name)"
    "units": "meters",
    "minimum": (minimum value),
    "strictMinimum": false,
    "maximum": (maximum value),
    "strictMaximum": false,
    "maxLength": (max length of string),
    "choices": [
      [(value choice 1), "(label for value choice 1)"],
      ...
    ],
    "widget": "(widget name)",
    "default": (default value),
    "required": true,
    "visible": true,
    "editable": true
  }

.. _PathElement:

PathElement Class
~~~~~~~~~~~~~~~~~

A PathElement instance is part of the geometry of the Plan_ and it can
contain commands in its ``sequence`` member.

Abstract class: Yes

Inherits from:
  TypedObject

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``sequence``      |array containing|optional         |A sequence of commands that should  |
|                  |Command_ entries|                 |be executed at or along this        |
|                  |                |                 |PathElement.                        |
|                  |                |                 |                                    |
|                  |                |                 |If not specified, the default       |
|                  |                |                 |interpretation is an empty sequence.|
+------------------+----------------+-----------------+------------------------------------+
|``uuid``          |string          |required         |Persistent universally unique       |
|                  |                |                 |identifier.                         |
|                  |                |                 |                                    |
|                  |                |                 |Typically a Version 4 UUID randomly |
|                  |                |                 |generated by the planning interface.|
+------------------+----------------+-----------------+------------------------------------+

.. _Plan:

Plan Class
~~~~~~~~~~

A Plan instance is the top level object of an XPJSON plan document.

Additional members in the Plan_ class may be specified in the
``planParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  TypedObject

+--------------------+-------------+----------------+------------------------------------+
|Member              |Type         |Values          |Meaning                             |
+====================+=============+================+====================================+
|``schemaUrl``       |string       |optional        |URL of the PlanSchema_ this Plan_   |
|                    |             |                |conforms to.                        |
+--------------------+-------------+----------------+------------------------------------+
|``libraryUrls``     |array of     |optional        |URLs of any PlanLibrary_ documents  |
|                    |string       |                |whose elements were available in the|
|                    |             |                |planning interface when this Plan_  |
|                    |             |                |was generated.                      |
+--------------------+-------------+----------------+------------------------------------+
|``planNumber``      |integer      |optional        |The number of this Plan_, if there  |
|                    |             |                |is a plan numbering scheme.         |
|                    |             |                |                                    |
|                    |             |                |This number might be set by the user|
|                    |             |                |or it might be auto-incremented by  |
|                    |             |                |the planning interface.             |
+--------------------+-------------+----------------+------------------------------------+
|``planVersion``     |string       |optional        |The version of the Plan_, if there  |
|                    |             |                |is a plan numbering scheme.         |
|                    |             |                |                                    |
|                    |             |                |If the Plan_ with a particular      |
|                    |             |                |``planNumber`` is updated and saved |
|                    |             |                |multiple times, the versions might  |
|                    |             |                |be marked ``"A"``, ``"B"``, ``"C"``,|
|                    |             |                |etc.                                |
+--------------------+-------------+----------------+------------------------------------+
|``site``            |Site_        |optional        |The operating area where this plan  |
|                    |             |                |will be executed.                   |
+--------------------+-------------+----------------+------------------------------------+
|``platform``        |Platform_    |optional        |The entity that will execute this   |
|                    |             |                |plan.                               |
+--------------------+-------------+----------------+------------------------------------+
|``targets``         |array of     |optional        |Target_ objects that can be         |
|                    |Target_      |                |referenced by stations or segments. |
+--------------------+-------------+----------------+------------------------------------+
|``sequence``        |array        |required        |The command sequence.               |
|                    |containing   |                |                                    |
|                    |Command_,    |                |                                    |
|                    |Station_, and|                |                                    |
|                    |Segment_     |                |                                    |
|                    |elements     |                |                                    |
|                    |             |                |                                    |
+--------------------+-------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Plan",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from Document
    "xpjson": "0.2",
    "subject": [
      "(tag 1)",
      ...
    ],
    "creator": "(creator)",
    "contributors": [
      "(contributor 1)",
      ...
    ],
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    // defined in Plan
    "schemaUrl": "(PlanSchema document URL)",
    "libraryUrls": [
      "(PlanLibrary document URL 1)",
      ...
    ],
    "planNumber": (Plan number),
    "planVersion": "(Plan version)",
    "site": { (Site) },
    "targets": [
      { (Target 1) },
      ...
    ],
    "sequence": [
      { (Sequence element 1) },
      ...
    ]
  }

.. _PlanLibrary:

PlanLibrary Class
~~~~~~~~~~~~~~~~~

A PlanLibrary instance is the top level object of an XPJSON PlanLibrary document.

Abstract class:
  No

Inherits from:
  TypedObject

+------------------+------------+----------------+------------------------------------+
|Member            |Type        |Values          |Meaning                             |
+==================+============+================+====================================+
|``schemaUrl``     |string      |optional        |URL of the PlanSchema_ that the     |
|                  |            |                |elements of this PlanLibrary_       |
|                  |            |                |conform to.                         |
+------------------+------------+----------------+------------------------------------+
|``sites``         |array of    |optional        |Site_ instances available in the    |
|                  |Site_       |                |planning interface.                 |
|                  |            |                |                                    |
|                  |            |                |The first Site_ in the list should  |
|                  |            |                |be considered the default for new   |
|                  |            |                |plans.                              |
+------------------+------------+----------------+------------------------------------+
|``platforms``     |array of    |optional        |Platform_ instances available in the|
|                  |Platform_   |                |planning interface.                 |
|                  |            |                |                                    |
|                  |            |                |The first Platform_ in the list     |
|                  |            |                |should be considered the default for|
|                  |            |                |new plans.                          |
+------------------+------------+----------------+------------------------------------+
|``stations``      |array of    |optional        |Station_ presets available in the   |
|                  |Station_    |                |planning interface.                 |
|                  |            |                |                                    |
|                  |            |                |A Station_ preset is a Station_     |
|                  |            |                |instance with no ``geometry``.      |
|                  |            |                |After a user adds a Station_ to a   |
|                  |            |                |Plan_, they should be able to apply |
|                  |            |                |one of the Station_ presets to set  |
|                  |            |                |its non-``geometry`` parameters.    |
+------------------+------------+----------------+------------------------------------+
|``segments``      |array of    |optional        |Segment_ presets available in the   |
|                  |Segment_    |                |planning interface.                 |
|                  |            |                |                                    |
|                  |            |                |A Segment_ preset is a Segment_     |
|                  |            |                |instance with no ``geometry``.      |
|                  |            |                |After a user adds a Segment_ to a   |
|                  |            |                |Plan_, they should be able to apply |
|                  |            |                |one of the Segment_ presets to set  |
|                  |            |                |its non-``geometry`` parameters.    |
+------------------+------------+----------------+------------------------------------+
|``targets``       |array of    |optional        |Target_ presets available in the    |
|                  |Target_     |                |planning interface.                 |
|                  |            |                |                                    |
|                  |            |                |A Target_ preset is a Target_       |
|                  |            |                |instance with no ``geometry``.      |
|                  |            |                |After a user adds a Target_ to a    |
|                  |            |                |Plan_, they should be able to apply |
|                  |            |                |one of the Target_ presets to set   |
|                  |            |                |its non-``geometry`` parameters.    |
+------------------+------------+----------------+------------------------------------+
|``commands``      |array of    |optional        |Commands available in the planning  |
|                  |Command_    |                |interface.                          |
|                  |            |                |                                    |
|                  |            |                |The user should be able to add a    |
|                  |            |                |command to their Plan_ by selecting |
|                  |            |                |from a menu of presets based on the |
|                  |            |                |PlanLibrary_.  After selecting a    |
|                  |            |                |preset, the ability to further edit |
|                  |            |                |each command parameter is controlled|
|                  |            |                |by the ``editable`` member of its   |
|                  |            |                |ParamSpec_.                         |
+------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "PlanLibrary",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from Document
    "xpjson": "0.2",
    "subject": [
      "(tag 1)",
      ...
    ],
    "creator": "(creator)",
    "contributors": [
      "(contributor 1)",
      ...
    ],
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    // defined in PlanLibrary
    "sites": [
      { (Site 1) },
      ...
    ],
    "platforms": [
      { (Platform 1) },
      ...
    ],
    "targets": [
      { (Target 1) },
      ...
    ],
    "stations": [
      { (Station 1) },
      ...
    ],
    "segments": [
      { (Segment 1) },
      ...
    ],
    "commands": [
      { (Command 1) },
      ...
    ]
  }

.. _PlanSchema:

PlanSchema Class
~~~~~~~~~~~~~~~~

A PlanSchema instance is the top level object of an XPJSON PlanSchema document.

Abstract class:
  No

Inherits from:
  TypedObject

+---------------------------+------------+----------------+------------------------------------+
|Member                     |Type        |Values          |Meaning                             |
+===========================+============+================+====================================+
|``paramSpecs``             |array of    |optional        |A place to put extra ParamSpec_     |
|                           |ParamSpec_  |                |objects that are used elsewhere as  |
|                           |            |                |parents for inheritance.            |
+---------------------------+------------+----------------+------------------------------------+
|``commandSpecs``           |array of    |optional        |Commands available in the planning  |
|                           |CommandSpec_|                |interface.                          |
+---------------------------+------------+----------------+------------------------------------+
|``unitSpecs``              |array of    |optional        |Unit conversions available in the   |
|                           |UnitSpec_   |                |planning interface.                 |
+---------------------------+------------+----------------+------------------------------------+
|``planParams``             |array of    |optional        |Extra parameters that may be        |
|                           |ParamSpec_  |                |specified in Plan_ instances.       |
+---------------------------+------------+----------------+------------------------------------+
|``stationParams``          |array of    |optional        |Extra parameters that may be        |
|                           |ParamSpec_  |                |specified in Station_ instances.    |
+---------------------------+------------+----------------+------------------------------------+
|``segmentParams``          |array of    |optional        |Extra parameters that may be        |
|                           |ParamSpec_  |                |specified in Segment_ instances.    |
+---------------------------+------------+----------------+------------------------------------+
|``targetParams``           |array of    |optional        |Extra parameters that may be        |
|                           |ParamSpec_  |                |specified in Target_ instances.     |
+---------------------------+------------+----------------+------------------------------------+
|``planSequenceCommands``   |array of    |optional        |Indicates which `Command            |
|                           |CommandSpec_|                |Subclasses`_ are allowed to appear  |
|                           |ids         |                |as top-level elements in the        |
|                           |            |                |``sequence`` member of the Plan_.   |
|                           |            |                |                                    |
|                           |            |                |The ``*SequenceCommands`` fields    |
|                           |            |                |allow the schema designer to        |
|                           |            |                |restrict Command types to be used   |
|                           |            |                |only in certain contexts (top-level |
|                           |            |                |Plan ``sequence``, Station          |
|                           |            |                |``sequence``, or Segment            |
|                           |            |                |``sequence``). The order in which   |
|                           |            |                |the Commands are listed may also    |
|                           |            |                |affect the order of presentation in |
|                           |            |                |the planning interface.             |
|                           |            |                |                                    |
|                           |            |                |If not specified, all non-abstract  |
|                           |            |                |`Command Subclasses`_ defined in    |
|                           |            |                |``commandSpecs`` are allowed.       |
+---------------------------+------------+----------------+------------------------------------+
|``stationSequenceCommands``|array of    |optional        |Indicates which `Command            |
|                           |CommandSpec_|                |Subclasses`_ are allowed to appear  |
|                           |ids         |                |in the ``sequence`` member of a     |
|                           |            |                |Station_.                           |
+---------------------------+------------+----------------+------------------------------------+
|``segmentSequenceCommands``|array of    |optional        |Indicates which `Command            |
|                           |CommandSpec_|                |Subclasses`_ are allowed to appear  |
|                           |ids         |                |in the ``sequence`` member of a     |
|                           |            |                |Segment_.                           |
+---------------------------+------------+----------------+------------------------------------+
|``planIdFormat``           |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Plan_   |
|                           |            |                |objects.                            |
+---------------------------+------------+----------------+------------------------------------+
|``stationIdFormat``        |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Station_|
|                           |            |                |objects.                            |
+---------------------------+------------+----------------+------------------------------------+
|``segmentIdFormat``        |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Segment_|
|                           |            |                |objects.                            |
+---------------------------+------------+----------------+------------------------------------+
|``commandIdFormat``        |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Command_|
|                           |            |                |objects that are found in the       |
|                           |            |                |``sequence`` member of a Station_ or|
|                           |            |                |Segment_.                           |
+---------------------------+------------+----------------+------------------------------------+
|``bareCommandIdFormat``    |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Command_|
|                           |            |                |objects found in the ``sequence``   |
|                           |            |                |member of a Plan_, outside a        |
|                           |            |                |Station_ or Segment_.               |
+---------------------------+------------+----------------+------------------------------------+
|``targetIdFormat``         |`format     |optional        |A format string used to             |
|                           |string`_    |                |auto-generate the ``id`` of Target_ |
|                           |            |                |objects.                            |
+---------------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "PlanSchema",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from Document
    "xpjson": "0.2",
    "subject": [
      "(tag 1)",
      ...
    ],
    "creator": "(creator)",
    "contributors": [
      "(contributor 1)",
      ...
    ],
    "dateCreated": "2012-03-01T10:05:07Z",
    "dateModified": "2012-03-02T11:23:15Z",

    // defined in PlanSchema
    "paramSpecs": [
      { (ParamSpec 1) },
      ...
    ],
    "commandSpecs": [
      { (CommandSpec 1) },
      ...
    ],
    "unitSpecs": [
      { (UnitSpec 1) },
      ...
    ]
    "planParams": [
      { (ParamSpec 1) },
      ...
    ],
    "targetParams": [
      { (ParamSpec 1) },
      ...
    ],
    "stationParams": [
      { (ParamSpec 1) },
      ...
    ],
    "segmentParams": [
      { (ParamSpec 1) },
      ...
    ],
    "planIdFormat": "(format)",
    "pathElementIdFormat": "(format)",
    "commandIdFormat": "(format)"
  }

.. _Platform:

Platform Class
~~~~~~~~~~~~~~

A Platform instance describes an entity that can execute a plan. This might
be a person, a robot, or a team.

Abstract class:
  No

Inherits from:
  TypedObject

(No additional fields beyond those specified in TypedObject.)

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Platform",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)"
    "uuid": "(uuid)",
    "derivedInfo": { ... },
  }

.. _Segment:

Segment Class
~~~~~~~~~~~~~

A Segment instance is an element of the command sequence that represents
motion along a path. A Segment can contain a sequence of commands which
should be executed during motion.

In some applications, the motion commands that cause the platform to
move along the Segment are implicit: the executive infers that motion is
required from the existence of the Segment and issues the necessary
commands automatically.

If the user needs the ability to specify parameters that change the
behavior of implicit motion commands, this can be enabled by adding the
parameters to the Segment class using the ``segmentParams`` member of
the PlanSchema_.

Implicit motion commands should be executed as blocking
commands *after* any commands found in the ``sequence`` member. That
way, any non-blocking commands in ``sequence`` are started before motion
occurs (and stopped automatically when motion along the Segment ends).

In other applications, the planning interface may insert explicit motion
commands in the ``sequence`` member. The executive then treats the
sequence like any other.

Abstract class:
  No

Inherits from:
  PathElement_

+------------------+------------+----------------+------------------------------------+
|Member            |Type        |Values          |Meaning                             |
+==================+============+================+====================================+
|``geometry``      |LineString  |optional        |For many applications this field is |
|                  |(see        |                |always unspecified and the implicit |
|                  |`GeoJSON    |                |geometry of the Segment is the      |
|                  |2008        |                |LineString connecting the Stations  |
|                  |geometry`_) |                |that bracket the segment.           |
|                  |            |                |                                    |
|                  |            |                |In some domains, the user may want  |
|                  |            |                |to specify a detailed path between  |
|                  |            |                |Segments by providing an explicit   |
|                  |            |                |LineString geometry. (But planning  |
|                  |            |                |interfaces are not required to      |
|                  |            |                |support editing the Segment         |
|                  |            |                |geometry.)                          |
+------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Segment",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from PathElement
    "geometry": {
      "type": "LineString",
      "coordinates": [
        [-122, 37],
        [-122, 36],
        [-121, 36]
      ]
    },
    "sequence": [
      { (Command 1) },
      ...
    ]
  }

.. _Site:

Site Class
~~~~~~~~~~

A Site instance is an operating area where a plan can be executed. Each
site may have its own associated coordinate frames.

Abstract class:
  No

Inherits from:
  TypedObject

+------------------+-----------+----------------+------------------------------------+
|Member            |Type       |Values          |Meaning                             |
+==================+===========+================+====================================+
|``crs``           |CRS object |optional        |Geometry coordinates in the plan are|
|                  |           |                |expressed in this coordinate        |
|                  |           |                |reference system.  See the `GeoJSON |
|                  |           |                |2008 CRS specification`_.           |
|                  |           |                |                                    |
|                  |           |                |The default CRS is OGC CRS84, a     |
|                  |           |                |geographic coordinate reference     |
|                  |           |                |system, using the WGS84 datum, in   |
|                  |           |                |[longitude, latitude] order with    |
|                  |           |                |units of decimal degrees.           |
|                  |           |                |                                    |
|                  |           |                |We normally use CRS84 for plans to  |
|                  |           |                |be executed in outdoor environments |
|                  |           |                |on Earth where GPS is available. In |
|                  |           |                |other environments (e.g. lunar      |
|                  |           |                |surface, inside ISS), a different   |
|                  |           |                |CRS may be required.                |
+------------------+-----------+----------------+------------------------------------+
|``alternateCrs``  |CRS object |optional        |An alternate coordinate reference   |
|                  |           |                |system, usually a local frame for   |
|                  |           |                |the site, which users of a planning |
|                  |           |                |interface may need to work with.    |
|                  |           |                |                                    |
|                  |           |                |Ideally, planning interfaces should |
|                  |           |                |be able to transform plan geometry  |
|                  |           |                |coordinates into the alternate CRS, |
|                  |           |                |display the resulting coordinate    |
|                  |           |                |values, and allow users to edit them|
|                  |           |                |in that format to be transformed    |
|                  |           |                |back into the primary CRS for       |
|                  |           |                |storage.                            |
|                  |           |                |                                    |
|                  |           |                |Other useful features would include |
|                  |           |                |a map reference grid and cursor     |
|                  |           |                |coordinate display in the alternate |
|                  |           |                |CRS.                                |
+------------------+-----------+----------------+------------------------------------+
|``bbox``          |array of   |optional        |A bounding box around the site that |
|                  |numbers    |                |can also serve as the initial map   |
|                  |           |                |view when creating a new plan.      |
|                  |           |                |Format defined by the `GeoJSON 2008 |
|                  |           |                |bounding box specification`_.       |
+------------------+-----------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Site",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in Site
    "crs": {
      "type": "name",
      "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
      }
    },
    "bbox": [-180, -90, 180, 90]
  }

.. _Station:

Station Class
~~~~~~~~~~~~~

A Station instance is an element of the command sequence that represents
a named location where the platform may stop to execute commands.

Additional members in the Station_ class may be specified in the
``stationParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  PathElement_

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``geometry``       |Point geometry  |required         |The location of the station.        |
|                   |(see `GeoJSON   |                 |                                    |
|                   |2008 geometry`_)|                 |                                    |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Station",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // inherited from PathElement
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
    "sequence": [
      { (Command 1) },
      ...
    ]
  }

.. _Target:

Target Class
~~~~~~~~~~~~

A Target instance is a named geometric object that can be referenced by
a PathElement_. Targets are usually used as annotations that explain plan
objectives but do not change the execution semantics.

Additional members in the Target_ class may be specified in the
``targetParams`` member of the PlanSchema_.

Abstract class:
  No

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``geometry``       |Point (see      |required         |The location of the Target.         |
|                   |`GeoJSON 2008   |                 |                                    |
|                   |geometry`_)     |                 |                                    |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Target",
    "name": "(name)",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in Target
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
  }

.. _UnitSpec:

UnitSpec Class
~~~~~~~~~~~~~~

A UnitSpec instance defines a set of comparable units and their relative values,
allowing a planning interface to support automatic unit conversion.

Abstract class:
  No

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``units``          |Dictionary of   |required         |A Dictionary mapping the (plural)   |
|                   |number          |                 |name of a unit to its relative      |
|                   |                |                 |value.                              |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "UnitSpec",
    "name": "length",
    "notes": "(notes)",
    "id": "(id)",
    "uuid": "(uuid)",
    "derivedInfo": { ... },

    // defined in UnitSpec
    "units": {
      "meters": 1.0,
      "km": 1000,
      "feet": 0.3048,
      "miles": 1609.344
    }
  }

.. _Format String:

Format Strings
==============

PlanSchema_ documents can use format strings to specify formal naming
conventions for elements of the Plan_. The format strings use a subset
of the `Python String Formatting`_ syntax.

If no format string is specified, the planning interface should default
to filling the relevant ``id`` field with a persistent randomly
generated UUID (same as the ``uuid`` field).

To substitute the value of a variable into the formatted output, you
include a pattern ``{<expression>:<printfFormat>}`` in the
template. Expressions are in the form ``variable.member.submember``
where member and submember are optional. Specifying a member extracts
the member with that name from the variable. The printf format component
is optional and defaults to ``:s``.

For example, the pattern ``{plan.planNumber:03d}`` substitutes in the
value of the ``planNumber`` member of the ``plan`` variable (which must
be an integer) and formats it as a 3-digit decimal string padded with
leading zeros. The pattern ``{plan.site.id}`` substitutes the ``id``
submember of the ``site`` member of the ``plan`` variable, with the
default ``:s`` formatting.

The variables available when filling the format are defined as follows:

+-----------------------+------------------------------+------------------------------------------+
|Format                 |Available variables           |Notes                                     |
+=======================+==============================+==========================================+
|``planIdFormat``       |``plan``                      |                                          |
+-----------------------+------------------------------+------------------------------------------+
|``stationIdFormat``    |``plan``, ``station``,        |``stationIndex`` is the index of the      |
|                       |``stationIndex``              |Station_ in the Plan_ ``sequence``        |
|                       |                              |array. It starts at 0 and is incremented  |
|                       |                              |after each Station_, so the first Station_|
|                       |                              |gets a ``stationIndex`` of 0. Segments and|
|                       |                              |bare Commands in the Plan_ ``sequence``   |
|                       |                              |are not numbered.                         |
+-----------------------+------------------------------+------------------------------------------+
|``segmentIdFormat``    |``plan``, ``segment``,        |``stationIndex`` has the same             |
|                       |``stationIndex``              |interpretation for Segments as it does for|
|                       |                              |Stations. The effect is that the          |
|                       |                              |``stationIndex`` of a Segment_ is the same|
|                       |                              |as the ``stationIndex`` of the next       |
|                       |                              |Station_. "Segment N is always on the way |
|                       |                              |to Station N."                            |
+-----------------------+------------------------------+------------------------------------------+
|``targetIdFormat``     |``plan``, ``target``,         |``targetIndex`` is the index of the       |
|                       |``targetIndex``               |Target_ in the Plan_ ``targets`` array. It|
|                       |                              |starts at 0 and is incremented after each |
|                       |                              |Target_, so the first Target_ gets a      |
|                       |                              |``targetIndex`` of 0.                     |
+-----------------------+------------------------------+------------------------------------------+
|``commandIdFormat``    |``plan``, ``parent``,         |This format applies to Commands that are  |
|                       |``stationIndex``, ``command``,|contained in the ``sequence`` array of a  |
|                       |``commandIndex``              |Station_ or Segment_. ``parent`` is the   |
|                       |                              |containing Station_ or                    |
|                       |                              |Segment_. ``stationIndex`` has the same   |
|                       |                              |meaning as above.                         |
|                       |                              |                                          |
|                       |                              |``commandIndex`` is the index of the      |
|                       |                              |Command_ in the parent ``sequence`` array.|
|                       |                              |It starts at 0 and is incremented after   |
|                       |                              |each Command_, so the first Command_ gets |
|                       |                              |a ``commandIndex`` of 0.                  |
+-----------------------+------------------------------+------------------------------------------+
|``bareCommandIdFormat``|``plan``, ``stationIndex``,   |This format applies to "bare" Commands    |
|                       |``command``                   |that are not contained in a Station_ or   |
|                       |                              |Segment_. (Thus the ``parent`` and        |
|                       |                              |``commandIndex`` fields of                |
|                       |                              |``commandIdFormat`` are not defined.)     |
|                       |                              |``stationIndex`` has the same meaning as  |
|                       |                              |above.                                    |
|                       |                              |                                          |
|                       |                              |Note that if an application domain does   |
|                       |                              |not permit bare Commands in the Plan_     |
|                       |                              |``sequence``, the relevant PlanSchema_    |
|                       |                              |would likely not define                   |
|                       |                              |``bareCommandIdFormat``.                  |
+-----------------------+------------------------------+------------------------------------------+

The fields available within each variable are the members defined for
that class in the XPJSON spec.

Note that id formats are resolved in a top-down manner, such that, for
example, the ``commandIdFormat`` can usefully refer to ``plan.id`` or
``parent.id``.

Example
~~~~~~~

If the PlanSchema_ contains the following formats::

  {
    "xpjson": "0.2",
    "type": "PlanSchema",
    ...

    "planIdFormat": "{plan.site.id}_{plan.planNumber:03d}{plan.planVersion}",
    "stationIdFormat": "STN{stationIndex:02d}",
    "segmentIdFormat": "SEG{stationIndex:02d}",
    "commandIdFormat": "{station.id}_{commandIndex:1d}_{command.presetCode}"
  }

The resulting Plan_ might have these auto-generated ``id`` values::

  {
    "xpjson": "0.2",
    "type": "Plan",
    "site": {
      "type": "Site",
      "id": "ARC",
      ...
    },
    "planNumber": 3,
    "planVersion": "B",
    "id": "ARC_003B",
    ...

    "sequence": [
      {
        "type": "Station",
        "id": "STN00",
        "sequence": [
          {
            "type": "Drive",
            "presetCode": "FDR",
            "id": "STN00_0_FDR",
            ...
          }
          ...
        ]
      },
      ...
    ]
  }

.. _GeoJSON 2008 CRS specification: http://geojson.org/geojson-spec.html#coordinate-reference-system-objects

.. _GeoJSON 2008 bounding box specification: http://geojson.org/geojson-spec.html#bounding-boxes

.. _GeoJSON 2008 geometry: http://geojson.org/geojson-spec.html#geometry-objects

.. _ISO 8601: http://www.w3.org/TR/NOTE-datetime

.. _Python String Formatting: http://docs.python.org/3/library/string.html#formatstrings

.. o __BEGIN_LICENSE__
.. o  Copyright (c) 2015, United States Government, as represented by the
.. o  Administrator of the National Aeronautics and Space Administration.
.. o  All rights reserved.
.. o 
.. o  The xGDS platform is licensed under the Apache License, Version 2.0
.. o  (the "License"); you may not use this file except in compliance with the License.
.. o  You may obtain a copy of the License at
.. o  http://www.apache.org/licenses/LICENSE-2.0.
.. o 
.. o  Unless required by applicable law or agreed to in writing, software distributed
.. o  under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
.. o  CONDITIONS OF ANY KIND, either express or implied. See the License for the
.. o  specific language governing permissions and limitations under the License.
.. o __END_LICENSE__

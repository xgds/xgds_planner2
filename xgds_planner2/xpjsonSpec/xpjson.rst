
=======================================================
The Exploration Plan JSON (XPJSON) Format Specification
=======================================================

Authors
  | Trey Smith (Carnegie Mellon University)
  | Tamar Cohen (NASA Ames Research Center)
  | David Lees (Carnegie Mellon University)

Revision
  Pre-0.1 draft

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
    "xpjson": "0.1",
    "type": "Plan",

    "name": "Marscape Traverse",
    "description": "A simple drive",
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
        "libraryId": "RoverStagingArea",
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
            "libraryId": "SPP",
            "blocking": false,
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
            "libraryId": "MI",
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
    "xpjson": "0.1",
    "type": "PlanSchema",

    "name": "Robot Science Schema",
    "description": "Define available robot science commands",
    "id": "http://example.com/robotScienceSchema.json",

    "planIdFormat": "%(site.id)s_%(plan.planNumber)03d%(plan.planVersion)s",
    "pathElementIdFormat": "%(pathElement.index)02d",
    "commandIdFormat": "%(pathElement.id)s_%(command.index)d_%(command.libraryId)s",

    "segmentParams": [
      {
        "type": "ParamSpec",
        "id": "speed",
        "name": "speed (m/s)",
        "valueType": "number",
        "minimum": 0,
        "description": "Estimated mean speed of drive (m/s)"
      },
      {
        "type": "ParamSpec",
        "id": "tolerance",
        "name": "tolerance (m)",
        "valueType": "number",
        "minimum": 0,
        "default": 1.0,
        "description": "How close we need to get to the target coordinates (meters)"
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
            "name": "duration",
            "valueType": "number",
            "minimum": 0,
            "description": "Estimated time required to execute command (minutes)"
          }
        ]
      },
      {
        "type": "CommandSpec",
        "id": "Image",
        "parent": "CommandWithDuration",
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
            "description": "White balance setting for camera; auto is usually ok"
          },
          {
            "type": "ParamSpec",
            "id": "focalLengthMm",
            "name": "Focal length (mm)",
            "valueType": "number",
            "minimum": 7.4,
            "maximum": 44,
            "description": "Actual (not 35 mm-equivalent) focal length of camera."
          }
        ]
      },
      {
        "type": "CommandSpec",
        "id": "MicroImage",
        "parent": "Image"
      },
      {
        "type": "CommandSpec",
        "id": "PeriodicPancam",
        "parent": "Image",
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
    ]
  }

A PlanLibrary_ providing reusable elements that were incorporated into
the plan::

  {
    "xpjson": "0.1",
    "type": "PlanLibrary",

    "name": "Robot Science Library",
    "description": "Reusable elements for robot driving plans",
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
        "id": "FPP",
        "whiteBalance": "A",
        "focalLengthMm": 7.4,
        "intervalSeconds": 2
      },
      {
        "type": "PeriodicPancam",
        "name": "SlowPeriodicPancam",
        "id": "SPP",
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
   "array", and "number", are defined in `IETF RTC 4627`_.  XPJSON
   documents have the standard JSON MIME type, "application/json".

.. _IETF RFC 2119: http://www.ietf.org/rfc/rfc2119.txt
.. _IETF RTC 4627: http://www.ietf.org/rfc/rfc4627.txt

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

   * StopCommand_

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
|``description``   |string          |optional         |Description                         |
+------------------+----------------+-----------------+------------------------------------+
|``id``            |string          |optional         |Unique identifier.                  |
|                  |                |                 |                                    |
|                  |                |                 |In some applications, the ``id`` is |
|                  |                |                 |part of a formal naming convention. |
|                  |                |                 |For example, the ``id`` of a command|
|                  |                |                 |might include ids from the site, the|
|                  |                |                 |plan, and the station that it is    |
|                  |                |                 |part of.                            |
|                  |                |                 |                                    |
|                  |                |                 |For PlanSchema_ and PlanLibrary_    |
|                  |                |                 |documents, we suggest using the     |
|                  |                |                 |canonical URL of the document as the|
|                  |                |                 |``id``.                             |
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
|``id``             |string          |required         |Unique identifier for the command.  |
|                   |                |                 |                                    |
|                   |                |                 |Probably auto-generated by the      |
|                   |                |                 |planning interface according to a   |
|                   |                |                 |naming convention.                  |
+-------------------+----------------+-----------------+------------------------------------+
|``libraryId``      |string          |optional         |When a user copies a command from   |
|                   |                |                 |the PlanLibrary_ into a Plan_, the  |
|                   |                |                 |planning interface should copy the  |
|                   |                |                 |``id`` member of the original       |
|                   |                |                 |command into the ``libraryId``      |
|                   |                |                 |member of the copy.                 |
+-------------------+----------------+-----------------+------------------------------------+
|``blocking``       |boolean         |``true``         |This command is blocking. Blocking  |
|                   |                |(default)        |commands have their own termination |
|                   |                |                 |conditions and run until those      |
|                   |                |                 |conditions are satisfied. The next  |
|                   |                |                 |command should be executed after    |
|                   |                |                 |this command completes.             |
|                   |                +-----------------+------------------------------------+
|                   |                |``false``        |This command is                     |
|                   |                |                 |non-blocking. Non-blocking commands |
|                   |                |                 |generally do not terminate on their |
|                   |                |                 |own. The executive should terminate |
|                   |                |                 |this command in either of two cases:|
|                   |                |                 |                                    |
|                   |                |                 | * It reaches an explicit           |
|                   |                |                 |   StopCommand_ that references this|
|                   |                |                 |   command.                         |
|                   |                |                 |                                    |
|                   |                |                 | * It reaches the end               |
|                   |                |                 |   of the scope containing this     |
|                   |                |                 |   command. (E.g.  the end of the   |
|                   |                |                 |   Station if this                  |
|                   |                |                 |   command is contained in a        |
|                   |                |                 |   Station.)                        |
|                   |                |                 |                                    |
|                   |                |                 |The next command should be executed |
|                   |                |                 |immediately after this command is   |
|                   |                |                 |executed, without waiting for this  |
|                   |                |                 |command to complete.                |
+-------------------+----------------+-----------------+------------------------------------+
|``scopeTerminate`` |boolean         |``true``         |(Non-blocking commands only.)  The  |
|                   |                |(default)        |executive should terminate this     |
|                   |                |                 |command when it reaches the end of  |
|                   |                |                 |the scope containing the command.   |
|                   |                +-----------------+------------------------------------+
|                   |                |``false``        |The executive should not terminate  |
|                   |                |                 |this command when it reaches the end|
|                   |                |                 |of its scope.                       |
+-------------------+----------------+-----------------+------------------------------------+

Command Subclasses
~~~~~~~~~~~~~~~~~~

Each CommandSpec_ object in the PlanSchema_ defines a new subclass of
the Command_ class. Instances of these subclasses may appear in the
``commands`` sequence of a Plan_.

The subclasses are arranged in their own class hierarchy, with
inheritance relationships specified by the ``parent`` member. Abstract
subclasses exist only to act as parents of other classes and must not be
included in the Plan_.

The PlanSchema_ designer can control how much flexibility is offered in
the planning interface. There are several possible conventions for a
schema:

 * Maximum flexibility: Allow users to set arbitrary values for
   parameters.  (These values can be limited to fall within a certain
   range via the ``minimum`` and ``maximum`` members.)

 * Per-parameter choices: Restrict users to a limited range of choices
   for each parameter using the ``choices`` member.

 * Command profiles: Sometimes we want to pre-define a set of profiles
   for a command, where each profile sets most or all of the parameter
   values for the command. Restricting users to choose from among these
   profiles has some advantages in terms of allowing the schema
   designer to choose descriptive names for the profiles ("wide low-res
   panorama", "narrow high-res panorama"), and allowing each profile to
   be thoroughly tested before deployment, for example to empirically
   measure the average time it takes to execute. To use profiles:

   * Place the profiles in the ``commands`` section of the
     PlanLibrary_.

   * Once the user has chosen a profile in the planning interface, their
     ability to further edit the parameter values set by the profile is
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
    "description": "-",
    "id": "ARC_R001A00_0_FWD",

    // inherited from Command
    "stationId": "ARC_R001A00",
    "libraryId": "FWD",

    // defined in DriveForward CommandSpec
    "distance": 0.5,
    "speed": 0.1
  }

The instance conforms to this CommandSpec_ in the PlanSchema_::

  {
    "type": "CommandSpec",
    "name": "DriveForward",
    "id": "FWD",
    "description": "Drive forward",
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

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``color``         |string          |optional         |The color to use to distinguish this|
|                  |                |                 |command type in the planning        |
|                  |                |                 |interface (for example, when an     |
|                  |                |                 |instance of the command appears in a|
|                  |                |                 |timeline).                          |
|                  |                |                 |                                    |
|                  |                |                 |Format: HTML-style ``"#rrggbb"``.   |
+------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "CommandSpec",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // inherited from ClassSpec
    "parent": "(parent CommandSpec id)",
    "abstract": false,
    "params": [
      { (ParamSpec 1) },
      ...
    ]
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
|``xpjson``        |string          |optional         |Indicates this is an XPJSON document|
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

+------------------+----------------+-----------------+------------------------------------+
|Member            |Type            |Values           |Meaning                             |
+==================+================+=================+====================================+
|``parent``        |string          |optional         |The ``id`` of ParamSpec_ in the     |
|                  |                |                 |``paramSpecs`` section of the       |
|                  |                |                 |PlanSchema_, from which this        |
|                  |                |                 |ParamSpec_ inherits members.        |
|                  |                |                 |                                    |
|                  |                |                 |The ``id`` member is not inherited. |
|                  |                |                 |                                    |
+------------------+----------------+-----------------+------------------------------------+
|``valueType``     |string          |``"string"``     |Parameter has string value.         |
|                  |                +-----------------+------------------------------------+
|                  |                |``"integer"``    |Parameter has integer value.        |
|                  |                +-----------------+------------------------------------+
|                  |                |``"number"``     |Parameter has numerical (floating   |
|                  |                |                 |point) value.                       |
|                  |                +-----------------+------------------------------------+
|                  |                |``"boolean"``    |Parameter has boolean value.        |
|                  |                +-----------------+------------------------------------+
|                  |                |``"geometry"``   |Parameter value is GeoJSON geometry |
|                  |                |                 |object, with values that make sense |
|                  |                |                 |in the CRS for the Site_.           |
|                  |                +-----------------+------------------------------------+
|                  |                |``"date-time"``  |A date and time. Specified as a     |
|                  |                |                 |number (milliseconds since UNIX     |
|                  |                |                 |epoch, Java style), or as a string  |
|                  |                |                 |in `ISO 8601`_ format               |
|                  |                |                 |``yyyy-mm-ddTHH:MM:SSZ``.           |
+------------------+----------------+-----------------+------------------------------------+
|``minimum``       |``valueType``   |optional         |Minimum legal value for parameter   |
|                  |                |                 |(parameter must have integer or     |
|                  |                |                 |number type).                       |
+------------------+----------------+-----------------+------------------------------------+
|``maximum``       |``valueType``   |optional         |Maximum legal value for parameter.  |
+------------------+----------------+-----------------+------------------------------------+
|``choices``       |array of        |optional         |If specified, the parameter value   |
|                  |[``valueType``, |                 |must be set to one of these choices.|
|                  |string] pairs   |                 |Each choice is a pair whose first   |
|                  |                |                 |element is a possible value for the |
|                  |                |                 |parameter and whose second value is |
|                  |                |                 |a text label used to describe the   |
|                  |                |                 |choice to a user of the planning    |
|                  |                |                 |interface.                          |
+------------------+----------------+-----------------+------------------------------------+
|``default``       |``valueType`` or|optional         |The default value of the            |
|                  |``null``        |                 |parameter. If not specified, the    |
|                  |                |                 |default value is ``null``.          |
+------------------+----------------+-----------------+------------------------------------+
|``required``      |boolean         |``true``         |The parameter must be specified.    |
|                  |                |(default)        |                                    |
|                  |                +-----------------+------------------------------------+
|                  |                |``false``        |The parameter is optional.          |
+------------------+----------------+-----------------+------------------------------------+
|``visible``       |boolean         |``true``         |Display the parameter in the detail |
|                  |                |(default)        |view for the command.               |
|                  |                +-----------------+------------------------------------+
|                  |                |``false``        |Hide the parameter                  |
+------------------+----------------+-----------------+------------------------------------+
|``editable``      |boolean         |``true``         |Allow the user to edit the          |
|                  |                |(default)        |parameter.                          |
|                  |                +-----------------+------------------------------------+
|                  |                |``false``        |Don't allow editing.                |
+------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "ParamSpec",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // defined in ParamSpec
    "parent": "(parent ParamSpec id)",
    "minimum": (minimum value),
    "maximum": (maximum value),
    "choices": [
      (value choice 1),
      ...
    ],
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
|``geometry``      |`GeoJSON        |optional         |The location of the PathElement_.   |
|                  |geometry`_      |                 |                                    |
+------------------+----------------+-----------------+------------------------------------+
|``sequence``      |array containing|optional         |A sequence of commands that should  |
|                  |Command_ and    |                 |be executed at this PathElement.    |
|                  |StopCommand_    |                 |                                    |
|                  |entries         |                 |                                    |
+------------------+----------------+-----------------+------------------------------------+
|``libraryId``     |string          |optional         |When a user copies an element from  |
|                  |                |                 |the PlanLibrary_ into a Plan_, the  |
|                  |                |                 |planning interface should record the|
|                  |                |                 |``id`` member of the original       |
|                  |                |                 |element in the ``libraryId`` member |
|                  |                |                 |of the copy.                        |
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
|                    |StopCommand_,|                |                                    |
|                    |Station_, and|                |                                    |
|                    |Segment_     |                |                                    |
|                    |elements     |                |                                    |
+--------------------+-------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Plan",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // inherited from Document
    "xpjson": "0.1",
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
+------------------+------------+----------------+------------------------------------+
|``platforms``     |array of    |optional        |Platform_ instances available in the|
|                  |Platform_   |                |planning interface.                 |
+------------------+------------+----------------+------------------------------------+
|``stations``      |array of    |optional        |Station_ instances available in the |
|                  |Station_    |                |planning interface.                 |
+------------------+------------+----------------+------------------------------------+
|``targets``       |array of    |optional        |Target_ instances available in the  |
|                  |Target_     |                |planning interface.                 |
+------------------+------------+----------------+------------------------------------+
|``segments``      |array of    |optional        |Segment_ instances available in the |
|                  |Segment_    |                |planning interface.                 |
+------------------+------------+----------------+------------------------------------+
|``commands``      |array of    |optional        |Commands available in the planning  |
|                  |Command_    |                |interface.                          |
|                  |            |                |                                    |
|                  |            |                |The user should be able to add a    |
|                  |            |                |command to their Plan_ by selecting |
|                  |            |                |from a menu of profiles based on the|
|                  |            |                |PlanLibrary_.  After selecting a    |
|                  |            |                |profile, the ability to further edit|
|                  |            |                |each command parameter is controlled|
|                  |            |                |by the ``editable`` member of its   |
|                  |            |                |ParamSpec_.                         |
|                  |            |                |                                    |
|                  |            |                |If the PlanLibrary_ doesn't specify |
|                  |            |                |any profiles for a given command    |
|                  |            |                |type, the user should still be able |
|                  |            |                |to instantiate a generic instance of|
|                  |            |                |that command type with each         |
|                  |            |                |parameter's initial value set by the|
|                  |            |                |``default`` member of its           |
|                  |            |                |ParamSpec_.                         |
+------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "PlanLibrary",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // inherited from Document
    "xpjson": "0.1",
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

+-----------------------+------------+----------------+------------------------------------+
|Member                 |Type        |Values          |Meaning                             |
+=======================+============+================+====================================+
|``paramSpecs``         |array of    |optional        |A place to put extra ParamSpec_     |
|                       |ParamSpec_  |                |objects that are used elsewhere as  |
|                       |            |                |parents for inheritance.            |
+-----------------------+------------+----------------+------------------------------------+
|``commandSpecs``       |array of    |optional        |Commands available in the planning  |
|                       |CommandSpec_|                |interface.                          |
+-----------------------+------------+----------------+------------------------------------+
|``planParams``         |array of    |optional        |Extra parameters that may be        |
|                       |ParamSpec_  |                |specified in Plan_ instances.       |
+-----------------------+------------+----------------+------------------------------------+
|``targetParams``       |array of    |optional        |Extra parameters that may be        |
|                       |ParamSpec_  |                |specified in Target_ instances.     |
+-----------------------+------------+----------------+------------------------------------+
|``stationParams``      |array of    |optional        |Extra parameters that may be        |
|                       |ParamSpec_  |                |specified in Station_ instances.    |
+-----------------------+------------+----------------+------------------------------------+
|``segmentParams``      |array of    |optional        |Extra parameters that may be        |
|                       |ParamSpec_  |                |specified in Segment_ instances.    |
+-----------------------+------------+----------------+------------------------------------+
|``planIdFormat``       |`format     |optional        |A format string used to             |
|                       |string`_    |                |auto-generate the ``id`` of Plan_   |
|                       |            |                |objects.                            |
+-----------------------+------------+----------------+------------------------------------+
|``pathElementIdFormat``|`format     |optional        |A format string used to             |
|                       |string`_    |                |auto-generate the ``id`` of         |
|                       |            |                |PathElement_ objects.               |
+-----------------------+------------+----------------+------------------------------------+
|``commandIdFormat``    |`format     |optional        |A format string used to             |
|                       |string`_    |                |auto-generate the ``id`` of Command_|
|                       |            |                |objects.                            |
+-----------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "PlanSchema",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // inherited from Document
    "xpjson": "0.1",
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
    "description": "(description)",
    "id": "(id)"
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
|``geometry``      |`GeoJSON    |optional        |The destination of a Segment's      |
|                  |geometry`_  |                |motion is typically the ``geometry``|
|                  |            |                |of the Station following the        |
|                  |            |                |Segment.                            |
|                  |            |                |                                    |
|                  |            |                |In applications where the user needs|
|                  |            |                |to specify a detailed path between  |
|                  |            |                |Stations, each Segment can include  |
|                  |            |                |its own ``geometry``, typically of  |
|                  |            |                |``LineString`` type.                |
+------------------+------------+----------------+------------------------------------+
|``sequence``      |array       |optional        |Commands to be executed while moving|
|                  |containing  |                |along the Segment.                  |
|                  |Command_ and|                |                                    |
|                  |StopCommand_|                |                                    |
|                  |entries     |                |                                    |
+------------------+------------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Segment",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

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
    ],
    "libraryId": "(id)"
  }

.. _Site:

Site Class
~~~~~~~~~~

A Site instance is an operating area where a plan can be executed. Each
site may have its own local coordinate frame.

Abstract class:
  No

Inherits from:
  TypedObject

+------------------+-----------+----------------+------------------------------------+
|Member            |Type       |Values          |Meaning                             |
+==================+===========+================+====================================+
|``crs``           |CRS object |optional        |Coordinate reference system (CRS)   |
|                  |           |                |object, as defined in the `GeoJSON  |
|                  |           |                |CRS specification`_. The default CRS|
|                  |           |                |is a geographic coordinate reference|
|                  |           |                |system, using the WGS84 datum, with |
|                  |           |                |longitude and latitude units of     |
|                  |           |                |decimal degrees.                    |
+------------------+-----------+----------------+------------------------------------+
|``bbox``          |array of   |optional        |A bounding box around the site that |
|                  |numbers    |                |can also serve as the initial map   |
|                  |           |                |view when creating a new plan.      |
|                  |           |                |Format defined by the `GeoJSON      |
|                  |           |                |bounding box specification`_.       |
+------------------+-----------+----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Site",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

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
|``geometry``       |`GeoJSON        |required         |The location of the station. Usually|
|                   |geometry`_      |                 |``Point`` geometry.                 |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Station",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // inherited from PathElement
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
    "sequence": [
      { (Command 1) },
      ...
    ],
    "libraryId": "(id)"
  }

.. _StopCommand:

StopCommand Class
~~~~~~~~~~~~~~~~~

A StopCommand instance is an element of a command sequence that stops execution
of a specified non-blocking command.

Abstract class:
  No

Inherits from:
  TypedObject

+-------------------+----------------+-----------------+------------------------------------+
|Member             |Type            |Values           |Meaning                             |
+===================+================+=================+====================================+
|``commandId``      |string          |optional         |The ``id`` of the non-blocking      |
|                   |                |                 |Command_ to stop.                   |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "StopCommand",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // defined in StopCommand
    "commandId": "(id of command to stop)"
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
|``geometry``       |`GeoJSON        |required         |The geometry of the Target.         |
|                   |geometry`_      |                 |                                    |
|                   |                |                 |For simple applications, Targets    |
|                   |                |                 |have ``Point`` type geometry, and   |
|                   |                |                 |when a PathElement_ refers to the   |
|                   |                |                 |Target, a line is drawn between the |
|                   |                |                 |two in the map display.             |
+-------------------+----------------+-----------------+------------------------------------+

Example
-------

::

  {
    // inherited from TypedObject
    "type": "Target",
    "name": "(name)",
    "description": "(description)",
    "id": "(id)",

    // defined in Target
    "geometry": {
      "type": "Point",
      "coordinates": [-122, 37]
    }
  }

.. _Format String:

Format Strings
==============

PlanSchema_ documents can use format strings to specify formal naming
conventions for elements of the Plan_. The format strings use `Python
String Formatting`_ syntax.

To substitute the value of a variable into the formatted output, you
include a pattern ``%(variableName)<printfFormat>`` in the template. For
example, the pattern ``%(planNumber)03d`` substitutes in the value of
the ``planNumber`` variable (which must be an integer) and formats it as
a 3-digit decimal string (padded with leading zeros).

The following variables are available for use in formats:

+-------------------------+----------+------------------------+-----------------------------------+
|Variable                 |Type      |Availability            |Meaning                            |
+=========================+==========+========================+===================================+
|site.id                  |string    |all                     |``id`` of the ``site`` of the Plan_|
+-------------------------+----------+------------------------+-----------------------------------+
|platform.id              |string    |all                     |``id`` of the ``platform`` of the  |
|                         |          |                        |Plan_                              |
+-------------------------+----------+------------------------+-----------------------------------+
|plan.planNumber          |integer   |all                     |``planNumber`` of the Plan_        |
+-------------------------+----------+------------------------+-----------------------------------+
|plan.planVersion         |string    |all                     |``planVersion`` of the             |
|                         |          |                        |Plan_. Versions are typically      |
|                         |          |                        |``"A"``, ``"B"``, ``"C"``, etc.    |
+-------------------------+----------+------------------------+-----------------------------------+
|plan.id                  |string    |``pathElementIdFormat``,|``id`` of the Plan_.  (This ``id`` |
|                         |          |``commandIdFormat``     |may have been auto-generated using |
|                         |          |                        |``planIdFormat``.)                 |
+-------------------------+----------+------------------------+-----------------------------------+
|pathElement.index        |integer   |``pathElementIdFormat``,|Index of the PathElement_ in the   |
|                         |          |``commandIdFormat``     |``sequence`` array of the          |
|                         |          |                        |Plan_. 0-based indexing.           |
+-------------------------+----------+------------------------+-----------------------------------+
|pathElement.id           |string    |``commandIdFormat``     |``id`` of the PathElement_. (This  |
|                         |          |                        |``id`` may have been auto-generated|
|                         |          |                        |using ``pathElementIdFormat``.)    |
+-------------------------+----------+------------------------+-----------------------------------+
|command.index            |integer   |``commandIdFormat``     |Index of the Command_ within its   |
|                         |          |                        |``sequence`` array. 0-based        |
|                         |          |                        |indexing.                          |
+-------------------------+----------+------------------------+-----------------------------------+
|command.libraryId        |string    |``commandIdFormat``     |``libraryId`` of the Command_      |
|                         |          |                        |                                   |
+-------------------------+----------+------------------------+-----------------------------------+
|command.type             |string    |``commandIdFormat``     |``type`` of the Command_           |
+-------------------------+----------+------------------------+-----------------------------------+

Example
~~~~~~~

If the PlanSchema_ contains the following formats::

  {
    "xpjson": "0.1",
    "type": "PlanSchema",
    ...

    "planIdFormat": "%(site.id)s_%(plan.planNumber)03d%(plan.planVersion)s",
    "pathElementIdFormat": "%(pathElement.index)02d",
    "commandIdFormat": "%(pathElement.id)s_%(command.index)d_%(command.libraryId)s"
  }

The resulting Plan_ might have these auto-generated ``id`` values::

  {
    "xpjson": "0.1",
    "type": "Plan",
    "site": {
      "type": "Site",
      "id": "ARC",
      ...
    },
    "planNumber": 3,
    "planVersion": "B",
    "id": "ARC_R003B",
    ...

    "sequence": [
      {
        "type": "Station",
        "id": "00",
        "sequence": [
          {
            "type": "Drive",
            "libraryId": "FDR",
            "id": "00_0_FDR",
            ...
          }
          ...
        ]
      },
      ...
    ]
  }

.. _GeoJSON CRS specification: http://geojson.org/geojson-spec.html#coordinate-reference-system-objects

.. _GeoJSON bounding box specification: http://geojson.org/geojson-spec.html#bounding-boxes

.. _GeoJSON geometry: http://geojson.org/geojson-spec.html#geometry-objects

.. _ISO 8601: http://www.w3.org/TR/NOTE-datetime

.. _Python String Formatting: http://docs.python.org/library/stdtypes.html#string-formatting

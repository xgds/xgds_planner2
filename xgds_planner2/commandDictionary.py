#!/usr/bin/env python

"""
A library and command-line utility for turning an XPJSON PlanSchema document
into an HTML-format command dictionary.

This tool focuses on the @commandSpecs part of the PlanSchema (and indirectly
on the @paramSpecs used by the commands). It doesn't output anything about
plan params, station params, segment params, etc. It might make sense to
extend the coverage at some point.

This tool does *not* output a simplified intermediate format such as
Markdown, Trac wiki, etc. on the way to HTML. That's because it uses
some fairly fancy HTML features such as nested tables that didn't seem
to lend themselves to that. However, it's fairly configurable, for
example, in terms of overriding templates.
"""

import argparse
import copy
import logging
import os
import re

from xgds_planner2 import xpjson
from xgds_planner2 import dotDict

# Python 3 compatibility
if not hasattr(__builtins__, "basestring"):
    basestring = (str, bytes)
    unicode = str

LTE_SYMBOL = "&#8804;"
GTE_SYMBOL = "&#8805;"

PARAMS_TABLE_COLUMNS = (
    "parameter",
    "type",
    "unit",
    "default",
    "constraints",
    "notes",
    "other",
)

DOC_TEMPLATE_HTML = """<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML//EN">
<html>
<head><style>
%(style)s
</style></head>
<body>
<h1 class="title">%(title)s</h1>
%(commands)s
</body></html>
"""

STYLE_SHEET = """
body {
  font-family: Sans-Serif;
}

h1.title {
  font-size: 1.5em;
  padding: 5px;
}

h2.title {
  font-size: 1.2em;
  padding: 5px;
}

div.command_index {
  padding-bottom: 20px;
}

div.commandSpec {
  border-top-style: solid;
  border-top-width: 3px;
  margin-bottom: 40px;
}

div.commandSpecId {
  font-size: 1.5em;
  background-color: #ddd;
  padding: 5px;
  font-weight: bold;
}

div.commandSpecNotes {
  padding-left: 5px;
  padding-top: 10px;
  padding-bottom: 10px;
}

.commandSpec table {
  border-collapse: collapse;
}

.commandSpec th {
  background-color: #ddd;
}

.commandSpec th, td {
  border: 1px solid black;
  text-align: left;
  vertical-align: top;
  padding: 5px;
}

.commandSpec td.param_choices_value {
  font-family: 'Courier', monospace;
}

td.inner_table {
  padding: 0px;
}

"""

COMMAND_SPEC_TEMPLATE_HTML = """
<div class="commandSpec">
  <div class="commandSpecId"><a name="command_%(id)s">%(id)s</a></div>
  <div class="commandSpecNotes">%(notes)s</div>
  <div class="commandSpecParams">
    %(paramsTable)s
  </div>
</div>
"""

DEFAULT_DICTIONARY_SETTINGS = {
    "title": "Command Dictionary",
    "styleSheet": STYLE_SHEET,
    "docTemplateHtml": DOC_TEMPLATE_HTML,
    "commandSpecTemplateHtml": COMMAND_SPEC_TEMPLATE_HTML,
    "includeIndex": True,
    # 'includeCommandSpecNameField': True,
    # 'includeCommandSpecNotesField': True,
    "includeCommandSpecNameField": False,
    "includeCommandSpecNotesField": False,
}


def appendField(d, entry, text):
    """
    Append @text to entry @entry in dict @d. If the entry
    is not defined, create it.
    """
    if entry not in d:
        d[entry] = text
    else:
        d[entry] += "; " + text


def htmlRepr(val):
    """
    Print HTML text for a Python object. Right now, the main value add
    is to print a string as a quoted string.

    This would probably be more robust using Python HTML libraries for
    escaping, but I'm too lazy to look it up right now.
    """
    if isinstance(val, (str, unicode)):
        return "&quot;%s&quot;" % val
    else:
        return str(val)


def getParamChoicesTableHtml(choices):
    """
    Convert the @choices dict object, which comes from the choices field
    of an XPJSON ParamSpec, into a two-column HTML table.
    """
    rlist = []

    def p(x):
        rlist.append(x)
        rlist.append("\n")

    p('<table class="param_choices">')
    p("  <tr>")
    for header in ("name", "value"):
        p('    <th class="param_choices_%s">%s</th>' % (header, header.capitalize()))
    p("  </tr>")
    for value, name in choices:
        p("  <tr>")
        p('    <td class="param_choices_name">%s</td>' % name)
        p('    <td class="param_choices_value">%s</td>' % htmlRepr(value))
        p("  </tr>")
    p("</table>")

    return "".join(rlist)


def prettify(s):
    s = re.sub("([a-z])([A-Z])", lambda m: m.group(1) + " " + m.group(2), s)
    s = s[0].capitalize() + s[1:]
    return s


def prettifySuperscript(s):
    if isinstance(s, basestring):
        return re.sub(r"\^(\-?\d+)", lambda m: ("<sup>%s</sup>" % m.group(1)), s)
    else:
        return s


def getParamInfo(p):
    """
    Convert an XPJSON ParamSpec into an intermediate representation prior
    to outputting it as a row in an HTML parameter table.

    The representation is a Python dict whose entries correspond to
    columns of the table.
    """

    result = {}

    result["type"] = p.valueType
    result["notes"] = p.notes
    result["unit"] = prettifySuperscript(p.unit)

    if p.name is not None:
        result["parameter"] = p.name
    else:
        result["parameter"] = prettify(p.id)

    if p.choices is not None:
        # logging.debug('%s', json.dumps(p.choices, sort_keys=True, indent=4))
        appendField(result, "constraints", getParamChoicesTableHtml(p.choices))

    if p.editable is False:
        appendField(result, "other", "uneditable")

    if p.maxLength is not None:
        appendField(result, "constraints", "length < %s" % p.maxLength)

    if p.minimum is not None and p.maximum is not None:
        if p.strictMinimum:
            minSymbol = "<"
        else:
            minSymbol = LTE_SYMBOL
        if p.strictMaximum:
            maxSymbol = "<"
        else:
            maxSymbol = LTE_SYMBOL
        constraint = "%s %s val %s %s" % (p.minimum, minSymbol, maxSymbol, p.maximum)
        appendField(result, "constraints", constraint)
    elif p.minimum is not None:
        if p.strictMinimum:
            symbol = ">"
        else:
            symbol = GTE_SYMBOL
        constraint = "val %s %s" % (symbol, p.minimum)
        appendField(result, "constraints", constraint)
    elif p.maximum is not None:
        if p.strictMaximum:
            symbol = "<"
        else:
            symbol = LTE_SYMBOL
        constraint = "val %s %s" % (symbol, p.maximum)
        appendField(result, "constraints", constraint)

    if p.default is not None:
        result["default"] = (
            "<span style=\"font-family: 'Courier';\">" + htmlRepr(p.default) + "</span>"
        )

    if p.default is None and p.required is True:
        result["default"] = "required"
    if p.visible is False:
        appendField(result, "other", "hidden")

    # logging.debug('%s', json.dumps(result, sort_keys=True, indent=4))

    return result


def getInfoTableHtml(columns, rows, tableClass):
    """
    Convert @rows, which is the output of getParamInfo(), into an HTML table.

    @columns is a list of columns to use in the table.

    @tableClass is the HTML class to put on the HTML table element, available for CSS styling.
    """

    nonEmptyColumns = [
        c
        for c in columns
        if not all([(row.get(c) is None or row[c] == "") for row in rows])
    ]

    rlist = []

    def p(x):
        rlist.append(x)
        rlist.append("\n")

    p('<table class="%s">' % tableClass)
    p("  <tr>")
    for c in nonEmptyColumns:
        p('    <th class="%s_%s">%s</th>' % (tableClass, c, c.capitalize()))
    p("  </tr>")

    for row in rows:
        p("  <tr>")
        for c in nonEmptyColumns:
            val = row.get(c)
            if val is None:
                val = ""
            classTag = "%s_%s" % (tableClass, c)
            if "<table" in val:
                classTag += " inner_table"
            p('    <td class="%s">%s</td>' % (classTag, val))
        p("  </tr>")
    p("</table>")

    return "".join(rlist)


def getCommandSpecInfo(settings, commandSpec):
    """
    Convert an XPJSON command spec into an intermediate representation,
    prior to outputting the HTML-formatted entry for the command in the
    command dictionary.

    The intermediate representation is a dict with fields corresponding to the
    different sections of the command entry in the dictionary.
    """
    paramIds = set([p.id for p in commandSpec.params])
    params = [getParamInfo(p) for p in commandSpec.params]

    if settings["includeCommandSpecNameField"] and "name" not in paramIds:
        nameParam = {
            "parameter": "Name",
            "type": "string",
            "default": "(auto-generated)",
            "notes": "Optionally, specify a meaningful name for an instance of the command, to appear in summary views of the plan",
        }
        params = [nameParam] + params

    if settings["includeCommandSpecNotesField"] and "notes" not in paramIds:
        notesParam = {
            "parameter": "Notes",
            "type": "string",
            "default": "",
            "notes": "A place to put arbitrary notes, for example, clarifying the intent of the command",
        }
        params.append(notesParam)

    return {"id": commandSpec.id, "notes": commandSpec.notes or "", "params": params}


def getCommandSpecHtml(commandSpecTemplateHtml, commandInfo):
    """
    Convert @commandInfo, which is the output of getCommandSpecInfo(), into
    the HTML-formatted entry for the command in the command dictionary.

    Uses @commandSpecTemplateHtml as the boilerplate string template.
    """
    paramsTable = getInfoTableHtml(
        PARAMS_TABLE_COLUMNS, commandInfo["params"], "params"
    )
    return commandSpecTemplateHtml % {
        "id": commandInfo["id"],
        "notes": commandInfo["notes"],
        "paramsTable": paramsTable,
    }


def writeCommandDictionary(inSchemaPath, outHtmlPath, **kwargs):
    """
    The master function that reads in an XPJSON PlanSchema document and outputs
    a command dictionary.
    """
    settings = copy.deepcopy(DEFAULT_DICTIONARY_SETTINGS)
    settings.update(kwargs)
    xpjson.CHECK_UNKNOWN_FIELDS = False  # suppress some warnings
    schema = xpjson.loadDocument(inSchemaPath)
    # schema = xpjson.loadDocument(inSchemaPath, fillInDefaults=True)
    # schema = dotDict.convertToDotDictRecurse(xpjson.loadDocument(inSchemaPath))
    hlist = []

    def p(x):
        hlist.append(x)
        hlist.append("\n")

    commandSpecs = sorted(schema.commandSpecs, key=lambda spec: spec.id)

    if settings["includeIndex"]:
        p('<div class="command_index">')
        p('  <h6 class="title">Index</h6>')
        p("  <ul>")
        for c in commandSpecs:
            p('    <li><a href="#command_%s">%s</a></li>' % (c.id, c.id))
        p("  </ul>")
        p("</div>")

    for c in commandSpecs:
        # logging.debug('%s', json.dumps(getCommandSpecInfo(settings, c), sort_keys=True, indent=4))
        commandInfo = getCommandSpecInfo(settings, c)
        chtml = getCommandSpecHtml(settings["commandSpecTemplateHtml"], commandInfo)
        p(chtml)

    outHtmlText = settings["docTemplateHtml"] % {
        "title": settings["title"],
        "style": settings["styleSheet"],
        "commands": "".join(hlist),
    }
    with open(outHtmlPath, "w") as outHtmlStream:
        outHtmlStream.write(outHtmlText)
    logging.info("wrote output to %s", outHtmlPath)


def main():
    parser = argparse.ArgumentParser(description=__doc__ + "\n\n",
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "inSchemaPath",
        help="input XPJSON schema path",
    )
    parser.add_argument(
        "outHtmlPath",
        help="output HTML command dictionary path",
        nargs="?",
        default=None,
    )
    args = parser.parse_args()
    if args.outHtmlPath is None:
        args.outHtmlPath = os.path.splitext(args.inSchemaPath)[0] + ".html"
        args.outHtmlPath = args.outHtmlPath.replace("PlanSchema", "CommandDictionary")
    logging.basicConfig(level=logging.DEBUG, format="%(message)s")
    # writeCommandDictionary(args.inSchemaPath, args.outHtmlPath)
    writeCommandDictionary(args.inSchemaPath, args.outHtmlPath,
                           includeCommandSpecNameField=False,
                           includeCommandSpecNotesField=False)


if __name__ == "__main__":
    main()

#!/usr/bin/env python

# Python 2.6+ or use simplejson
import json

# pip install jsonschema
import jsonschema

def jsonSchemaValidate(objPath, schemaPath):
    print 'Validating %s against %s' % (objPath, schemaPath),
    obj = json.loads(file(objPath).read())
    schema = json.loads(file(schemaPath).read())

    # throws exception on failure
    jsonschema.validate(obj, schema)

    print 'PASSED'

def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog <object.json> <schema.json>')
    opts, args = parser.parse_args()
    if len(args) != 2:
        parser.error('expected exactly 2 args')
    jsonSchemaValidate(args[0], args[1])

if __name__ == '__main__':
    main()

#!/usr/bin/env python
# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

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
    _opts, args = parser.parse_args()
    if len(args) != 2:
        parser.error('expected exactly 2 args')
    jsonSchemaValidate(args[0], args[1])

if __name__ == '__main__':
    main()

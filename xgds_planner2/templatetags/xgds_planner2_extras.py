from django import template

register = template.Library()

@register.tag(name="nest")
def do_context_aware(parser, token):
    try:
        tag_name, egg, in_word, nest, at_word, at = token.split_contents()
    except ValueError:
        raise template.TemplateSyntaxError()
    if in_word != "in": raise template.TemplateSyntaxError()
    if at_word != "at": raise template.TemplateSyntaxError()
    nest = nest.strip("'") # remove quotes around nest for later
    nest = nest.strip('"')
    egg = egg.strip("'") # remove quotes for parsing purposes
    egg = egg.strip('"')
    at = at.strip("'") # remove quotes from at for matching
    at = at.strip('"')
    return ContextAware(nest, egg, at)

class ContextAware(template.Node):
    def __init__(self, nest, egg, at):
        self.nest = nest
        self.egg = egg
        self.at = at

    def render(self, context):
        nest_parts = self.nest.split(self.at)
        egg_template = template.Template(self.egg)
        rendered_egg = egg_template.render(context)
        complete_nest = rendered_egg.join(nest_parts)
        nest_template = template.Template(complete_nest)
        rendered_nest = nest_template.render(context)
        return rendered_nest

# -*- coding: utf-8 -*-
"""Example content for the onboarding playbook builder (placeholder text only).

Copy this file to content.py, replace every value with your program's content,
put photos in assets/photos/ and fonts in assets/fonts/ (see README), then run build.py.
The schema mirrors what the builders expect: 3 phases, modules m01-m08, and the
block types used inside each module.
"""

BRAND = {'eyebrow': 'PROGRAM',
 'lockup_top': 'PROGRAM',
 'lockup_by': 'By',
 'lockup_brand': 'Example Co',
 'program': 'The Example Onboarding Playbook',
 'program_short': 'Example Playbook',
 'tagline': 'Prepare. Present. Win.',
 'subtitle': 'A step-by-step onboarding workflow.',
 'manager_name': 'Your Manager',
 'manager_title': 'Sales Manager',
 'market': 'Your Market',
 'doc_title': 'Example Onboarding',
 'version': 'Version 1',
 'closing_line': 'Sample closing line.',
 'tier': 'Program',
 'price_tier': 'Top-tier',
 'assistant': 'your AI assistant',
 'org': 'Example Co',
 'store_key': 'example-playbook-v1'}

THEME = {'espresso': '#33302E',
 'espresso_2': '#45403C',
 'taupe': '#D8D2CA',
 'taupe_light': '#E9E5DF',
 'ivory': '#F6F4F0',
 'paper': '#FBFAF8',
 'charcoal': '#262422',
 'muted': '#6E6862',
 'line': '#D2CCC4',
 'red': '#2F5D8A',
 'red_dark': '#234868',
 'green': '#5E7A5A',
 'amber': '#B7863B'}

PHOTOS = {'hero': ('hero.jpg', 'photo-id'),
 'prepare': ('prepare.jpg', 'photo-id'),
 'present': ('present.jpg', 'photo-id'),
 'win': ('win.jpg', 'photo-id'),
 'm01': ('m01.jpg', 'photo-id'),
 'm02': ('m02.jpg', 'photo-id'),
 'm03': ('m03.jpg', 'photo-id'),
 'm04': ('m04.jpg', 'photo-id'),
 'm05': ('m05.jpg', 'photo-id'),
 'm06': ('m06.jpg', 'photo-id'),
 'm07': ('m07.jpg', 'photo-id'),
 'm08': ('m08.jpg', 'photo-id'),
 'close': ('close.jpg', 'photo-id')}

PHOTO_CREDIT = 'Photography credit goes here.'

RESOURCES = {'res_01': {'label': 'Sample text Sample text.',
            'title': 'Sample text Sample text Sa.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text.',
            'url': 'https://example.com/resource-1',
            'access': 'Public website',
            'module': 'm04',
            'qr': True},
 'res_02': {'label': 'Sample text Sample text Sample te.',
            'title': 'Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text.',
            'url': 'https://example.com/resource-2',
            'access': 'Public website',
            'module': 'm04',
            'qr': True},
 'res_03': {'label': 'Sample text Sample text.',
            'title': 'Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                    'Sample text.',
            'url': 'https://example.com/resource-3',
            'access': 'Public website',
            'module': 'm04',
            'qr': True},
 'res_04': {'label': 'Sample text Sample text Sample.',
            'title': 'Sample text Sample te.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                    'Sample text.',
            'url': 'https://example.com/resource-4',
            'access': 'Public website',
            'module': 'm04',
            'qr': True},
 'res_05': {'label': 'Sample text Sample text.',
            'title': 'Sample label label',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sampl.',
            'url': 'https://example.com/resource-5',
            'access': 'Public website',
            'module': 'm02',
            'qr': True},
 'res_06': {'label': 'Sample label label',
            'title': 'Sample text Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sam.',
            'url': 'https://example.com/resource-6',
            'access': 'Public website',
            'module': 'm02',
            'qr': True},
 'res_07': {'label': 'Sample label label',
            'title': 'Sample text Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample t.',
            'url': 'https://example.com/resource-7',
            'access': 'Public website',
            'module': 'm02',
            'qr': True},
 'res_08': {'label': 'Sample text Sample.',
            'title': 'Sample text Sample te.',
            'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text.',
            'url': 'https://example.com/resource-8',
            'access': 'Public website',
            'module': 'm03',
            'qr': True},
 'res_09': {'label': 'Sample text Sample te.',
            'title': 'Sample text Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sampl.',
            'url': 'https://example.com/resource-9',
            'access': 'Public website',
            'module': 'm03',
            'qr': True},
 'res_10': {'label': 'Sample text Sample text.',
            'title': 'Sample text Sample text.',
            'desc': 'Sample text Sample text Sample text Sample text Sample t.',
            'url': 'https://example.com/resource-10',
            'access': 'Public website',
            'module': 'm08',
            'qr': True},
 'res_11': {'label': 'Sample label label',
            'title': 'Sample text Sample text S.',
            'desc': 'Sample text Sample text Sample text Sample text.',
            'url': 'https://example.com/resource-11',
            'access': 'Public website',
            'module': 'm06',
            'qr': True}}

DELIVERABLES = {'folder': '', 'dashboard': '', 'dashboard_copy': '', 'pdf': '', 'web': ''}

PHASES = [{'id': 'prepare',
  'num': '1',
  'name': 'Sample',
  'title': 'Sample text Sample text Sample text Sa.',
  'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
           'Sample text Sample text Sample text Sample text Sample text Sample text.',
  'photo': 'prepare',
  'modules': ['m01', 'm02', 'm03']},
 {'id': 'present',
  'num': '2',
  'name': 'Sample',
  'title': 'Sample text Sample text Sample text Sample text Sample text Sample.',
  'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
           'Sample text Sample text Sample text Sample text Sample tex.',
  'photo': 'present',
  'modules': ['m04', 'm05']},
 {'id': 'win',
  'num': '3',
  'name': 'Sample',
  'title': 'Sample label label',
  'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
           'Sample text Sample text Sample text Sample text Sample text Sample text.',
  'photo': 'win',
  'modules': ['m06', 'm07', 'm08']}]

AUDIT = [{'num': '01',
  'title': 'Sample label label',
  'question': 'Sample text Sample text Sample text Sample text Sample text.',
  'items': [{'id': 'a_consult', 'label': 'Sample label label', 'fix': 'm05'},
            {'id': 'a_flyers', 'label': 'Sample label', 'fix': 'm05'},
            {'id': 'a_case', 'label': 'Sample text Sample text.', 'fix': 'm04'},
            {'id': 'a_email', 'label': 'Sample text Sample text Sample text.', 'fix': 'm05'}]},
 {'num': '02',
  'title': 'Sample label',
  'question': 'Sample text Sample text Sample text Sample text Sample text Sample text.',
  'items': [{'id': 'a_bio', 'label': 'Sample label', 'fix': 'm02'},
            {'id': 'a_headshot', 'label': 'Sample label', 'fix': 'm02'},
            {'id': 'a_site', 'label': 'Sample label', 'fix': 'm02'},
            {'id': 'a_blog', 'label': 'Sample label', 'fix': 'm02'}]},
 {'num': '03',
  'title': 'Sample label label',
  'question': 'Sample text Sample text Sample text Sample text Sample t.',
  'items': [{'id': 'a_talk', 'label': 'Sample text Sample text.', 'fix': 'm05'},
            {'id': 'a_vp', 'label': 'Sample label label', 'fix': 'm05'}]}]

AUDIT_BANDS = [{'min': 90, 'name': 'Sample', 'text': 'Sample text Sample text Sample text Sample text Sample te.'},
 {'min': 60,
  'name': 'Sample',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample t.'},
 {'min': 0, 'name': 'Sample label', 'text': 'Sample text Sample text Sample text Sample text Sample text.'}]

PIPELINE_PROMPTS = [{'id': 'pipeline_1',
  'title': 'Sample label',
  'desc': 'Sample text Sample text Sample text Sample text Sample text.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text.'},
 {'id': 'pipeline_2',
  'title': 'Sample label',
  'desc': 'Sample text Sample text Sample text Sample text Sample text Sampl.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text.'},
 {'id': 'pipeline_3',
  'title': 'Sample label',
  'desc': 'Sample text Sample text Sample text Sample text Sample text.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text.'}]

MODULES = {'m01': {'num': '01',
         'short': 'Sample',
         'phase': 'prepare',
         'title': 'Sample text Sample.',
         'kicker': 'Sample text Sample text Sample text Sample text S.',
         'time': '30 min',
         'photo': 'm01',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample t.',
         'actions': [{'id': 'm01_a1', 'text': 'Sample text Sample text Sample text Sample text Sam.'},
                     {'id': 'm01_a2', 'text': 'Sample text Sample text Sample text Sample tex.'},
                     {'id': 'm01_a3', 'text': 'Sample text Sample text Sample text Sample text Sample tex.'},
                     {'id': 'm01_a4', 'text': 'Sample text Sample text Sample text Sample te.'}],
         'blocks': [{'type': 'audit'},
                    {'type': 'callout',
                     'tone': 'coach',
                     'title': 'Sample text Sample text Sample.',
                     'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample.'}]},
 'm02': {'num': '02',
         'key_resource': 'res_05',
         'short': 'Sample',
         'phase': 'prepare',
         'title': 'Sample text Sample text.',
         'kicker': 'Sample text Sample text.',
         'time': '60–90 min',
         'photo': 'm02',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Samp.',
         'actions': [{'id': 'm02_a1',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample te.'},
                     {'id': 'm02_a2',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample t.'},
                     {'id': 'm02_a3',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample.'},
                     {'id': 'm02_a4',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Samp.'},
                     {'id': 'm02_a5',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample.'}],
         'blocks': [{'type': 'steps',
                     'title': 'Sample text Sample text Sample text.',
                     'items': [{'num': '01',
                                'title': 'Sample text Sample text.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sample text S.',
                                'resource': 'res_05'},
                               {'num': '02',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text.',
                                'resource': 'res_06'},
                               {'num': '03',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sample text '
                                        'Sample text Sample.',
                                'resource': 'res_07'}]},
                    {'type': 'checklist',
                     'id': 'm02_std',
                     'source': 'coach',
                     'title': 'Sample text Sample text Sample text.',
                     'items': ['Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text Sample text Sample t.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text Sample text Sample tex.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text Sample text Sam.',
                               'Sample text Sample text Sample text Sample text Sample text Sa.']},
                    {'type': 'quote',
                     'text': 'Sample text Sample text Sample text Sample text Sample text.'}]},
 'm03': {'num': '03',
         'key_resource': 'res_08',
         'short': 'Sample label',
         'phase': 'prepare',
         'title': 'Sample text Sample text Sample text.',
         'kicker': 'Sample text Sample text Sample text Sample text Sample.',
         'time': '20 min',
         'photo': 'm03',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text.',
         'actions': [{'id': 'm03_a1', 'text': 'Sample text Sample text Sample text.'},
                     {'id': 'm03_a2',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sa.'},
                     {'id': 'm03_a3', 'text': 'Sample text Sample text Sample text Sample text.'},
                     {'id': 'm03_a4',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sa.'}],
         'blocks': [{'type': 'flow'},
                    {'type': 'prompt',
                     'id': 'prompt_1',
                     'title': 'Sample text Sample text Sa.',
                     'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sa.',
                     'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text.',
                     'resource': 'res_08'},
                    {'type': 'prompt',
                     'id': 'prompt_2',
                     'title': 'Sample text Sample text Sample text Sample t.',
                     'desc': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text.',
                     'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text.',
                     'resource': 'res_09'}]},
 'm04': {'num': '04',
         'key_resource': 'res_03',
         'short': 'Sample label',
         'phase': 'present',
         'title': 'Sample text Sample te.',
         'kicker': 'Sample text Sample text Sample text Sample text Sample text Sample.',
         'time': '2 hrs',
         'photo': 'm04',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sa.',
         'goal': 'Sample text Sample text Sample text Sample text Sample text Sample text.',
         'actions': [{'id': 'm04_a1', 'text': 'Sample text Sample text Sample text Sample text Sample te.'},
                     {'id': 'm04_a2', 'text': 'Sample text Sample text Sample text Sample text Sample.'},
                     {'id': 'm04_a3', 'text': 'Sample text Sample text Sample tex.'},
                     {'id': 'm04_a4', 'text': 'Sample text Sample text Sample text Sample text.'},
                     {'id': 'm04_a5',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Samp.'}],
         'blocks': [{'type': 'criteria',
                     'step': '01',
                     'title': 'Sample text Sample tex.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text Sample text Sample text Sampl.',
                     'items': [{'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sa.',
                                'resource': 'res_01'},
                               {'title': 'Sample text Sample text.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sa.',
                                'resource': 'res_02'},
                               {'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text.',
                                'resource': 'res_03'},
                               {'title': 'Sample text Sample te.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample.',
                                'resource': 'res_04'}]},
                    {'type': 'table',
                     'title': 'Sample text Sample text Sample text Sample text Sample text.',
                     'headers': ['Sample text Sample text Sample t.', 'Sample label'],
                     'rows': [["They know how to tell a home's story", 'The positioning and marketing'],
                              ['They get top dollar', 'Pricing strategy and negotiation'],
                              ["They'll do something others won't", 'A creative launch or event'],
                              ["They adapt when the plan isn't working", 'What you changed, and why']]},
                    {'type': 'checklist',
                     'id': 'm04_facts',
                     'step': '02',
                     'title': 'Sample label label',
                     'intro': 'Sample text Sample text Samp.',
                     'items': ['Sample text Sample text S.',
                               'Sample text Sample text Sample text Samp.',
                               'Sample label label',
                               'Sample text Sample text Sample text Sample text Sample text Sample.',
                               'Sample text Sample text Sampl.',
                               'Sample text Sample text Sample text Sample text.',
                               'Sample text Sample text Sample text Sample text Sample te.',
                               'Sample text Sample text Sample text Sample t.',
                               'Sample label label']},
                    {'type': 'template',
                     'id': 'm04_tpl',
                     'step': '03',
                     'title': 'Sample text Sample t.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text Sam.',
                     'fields': [{'id': 'cs_headline',
                                 'label': 'Sample',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample text '
                                          'Sample text Sample text Sample text S.',
                                 'lines': 1},
                                {'id': 'res_01',
                                 'label': 'Sample label',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample text '
                                          'Sample text Sample text Sample text Sample text Sample text '
                                          'Sample text Sample.',
                                 'lines': 3},
                                {'id': 'cs_move1',
                                 'label': 'Sample text Sampl.',
                                 'guide': 'Sample text Sample text Sample t.',
                                 'lines': 1},
                                {'id': 'cs_move2',
                                 'label': 'Sample text Sampl.',
                                 'guide': 'Sample label',
                                 'lines': 1},
                                {'id': 'cs_move3',
                                 'label': 'Sample text Sampl.',
                                 'guide': 'Sample label',
                                 'lines': 1},
                                {'id': 'res_03',
                                 'label': 'Sample label',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample text '
                                          'Sample text Sample text Sample text.',
                                 'lines': 2},
                                {'id': 'cs_quote',
                                 'label': 'Sample text Sample te.',
                                 'guide': 'Sample label label',
                                 'lines': 1}]},
                    {'type': 'checklist',
                     'id': 'm04_checks',
                     'step': '04',
                     'title': 'Sample text Sample text Samp.',
                     'items': ['Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sampl.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text Sa.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text Sample text Sample text Sample text Sample.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text.']},
                    {'type': 'example'}]},
 'm05': {'num': '05',
         'short': 'Sample label',
         'phase': 'present',
         'title': 'Sample text Sample text.',
         'kicker': 'Sample text Sample text Sample text Sample text Sample text.',
         'time': '2–3 hrs',
         'photo': 'm05',
         'source': 'coach',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text S.',
         'actions': [{'id': 'm05_a1',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm05_a2',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm05_a3',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample tex.'},
                     {'id': 'm05_a4', 'text': 'Sample text Sample text Sample text Sample text.'},
                     {'id': 'm05_a5',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text.'},
                     {'id': 'm05_a6',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sa.'}],
         'blocks': [{'type': 'builder',
                     'id': 'm05_vp',
                     'title': 'Sample text Sample text Sample te.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text Sample text Sample text Sample text.',
                     'formula': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                                'Sample text Sample text Samp.',
                     'fields': [{'id': 'vp_who',
                                 'label': 'Sample',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample text.'},
                                {'id': 'vp_where', 'label': 'Sample', 'guide': 'Sample label label'},
                                {'id': 'vp_what',
                                 'label': 'Sample label',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample text.'},
                                {'id': 'vp_how',
                                 'label': 'Sample',
                                 'guide': 'Sample text Sample text Sample text Sample text.'},
                                {'id': 'vp_proof',
                                 'label': 'Sample label',
                                 'guide': 'Sample text Sample text Sample text Sample text Sample.'}]},
                    {'type': 'talk',
                     'id': 'm05_talk',
                     'title': 'Sample text Sample text Sample text Sample.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text.',
                     'beats': [{'time': '0:00–0:20',
                                'title': 'Sample label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                               {'time': '0:20–0:50',
                                'title': 'Sample label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text.'},
                               {'time': '0:50–1:20',
                                'title': 'Sample label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text.'},
                               {'time': '1:20–1:45',
                                'title': 'Sample label',
                                'text': 'Sample text Sample text Sample text Sample text Sample te.'},
                               {'time': '1:45–2:00',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text.'}]},
                    {'type': 'checklist',
                     'id': 'm05_mat',
                     'title': 'Sample text Sample te.',
                     'items': ['Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample tex.',
                               'Sample text Sample text Sample text Sample text Sample text.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text.',
                               'Sample text Sample text Sample text Sample text Sample text Sample text '
                               'Sample text.']}]},
 'm06': {'num': '06',
         'key_resource': 'res_11',
         'short': 'Sample label',
         'phase': 'win',
         'title': 'Sample label label',
         'kicker': 'Sample text Sample text Sample text Sample text Sample text.',
         'time': '2 hrs + mail',
         'photo': 'm06',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text.',
         'actions': [{'id': 'm06_a1',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm06_a2', 'text': 'Sample text Sample text Sample text Sample text.'},
                     {'id': 'm06_a3', 'text': 'Sample text Sample text Sample text Sample text Sample tex.'},
                     {'id': 'm06_a4', 'text': 'Sample text Sample text Sample text Sample text.'},
                     {'id': 'm06_a5', 'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm06_a6',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text.'}],
         'blocks': [{'type': 'steps',
                     'title': 'Sample text Sample text.',
                     'items': [{'num': '01',
                                'title': 'Sample text Sample text Sample tex.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sam.'},
                               {'num': '02',
                                'title': 'Sample text Sample text Sample te.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text.'},
                               {'num': '03',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                               {'num': '04',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sample text '
                                        'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text.'},
                               {'num': '05',
                                'title': 'Sample text Sample text.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sample text '
                                        'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text.'},
                               {'num': '06',
                                'title': 'Sample text Sample text Sampl.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample t.'}]},
                    {'type': 'touches'},
                    {'type': 'tips',
                     'title': 'Sample label label',
                     'items': [{'text': 'Sample text Sample text Sample text Sample te.'},
                               {'text': 'Sample text Sample text Sample te.'},
                               {'text': 'Sample text Sample text Sample text Sam.', 'resource': 'res_11'}]},
                    {'type': 'tracker',
                     'id': 'm06_trk',
                     'title': 'Sample label label',
                     'columns': ['Sample label',
                                 'Sample label',
                                 'Sample label label',
                                 'Sample label label',
                                 'Sample text Sample t.'],
                     'rows': 5}]},
 'm07': {'num': '07',
         'short': 'Sample',
         'phase': 'win',
         'title': 'Sample label',
         'kicker': 'Sample text Sample text Sample text.',
         'time': '2 hrs to launch, then ongoing',
         'photo': 'm07',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text.',
         'actions': [{'id': 'm07_a1', 'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm07_a2',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sam.'},
                     {'id': 'm07_a3',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Samp.'},
                     {'id': 'm07_a4',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text.'}],
         'blocks': [{'type': 'steps',
                     'title': 'Sample label',
                     'items': [{'num': '01',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text.'},
                               {'num': '02',
                                'title': 'Sample text Sample text.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text.'},
                               {'num': '03',
                                'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sample text Sample text Sample text Sample text Sam.'}]},
                    {'type': 'chips',
                     'title': 'Sample text Sample text.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text Sample text.',
                     'items': ['Sample label', 'Sample label', 'Sample', 'Sample label', 'Sample', 'Sample']},
                    {'type': 'email',
                     'id': 'm07_email',
                     'title': 'Sample text Sample text Sample text.',
                     'subject': 'Sample text Sample text Sample text Sample.',
                     'body': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample text '
                             'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sa.'},
                    {'type': 'cards',
                     'title': 'Sample text Sample text.',
                     'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample text Sample text Sample t.',
                     'items': [{'title': 'Sample text Sample text.',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text.'},
                               {'title': 'Sample label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text Sa.'},
                               {'title': 'Sample label label',
                                'text': 'Sample text Sample text Sample text Sample text Sample text Sample '
                                        'text.'}]},
                    {'type': 'tracker',
                     'id': 'm07_trk',
                     'title': 'Sample label label',
                     'columns': ['Sample label label',
                                 'Sample',
                                 'Sample label',
                                 'Sample label',
                                 'Sample text Sample text Sam.'],
                     'rows': 6}]},
 'm08': {'num': '08',
         'key_resource': 'res_10',
         'short': 'Sample label',
         'phase': 'win',
         'title': 'Sample text Sam.',
         'kicker': 'Sample text Sample text Sample text Sample text.',
         'time': '30 min / week',
         'photo': 'm08',
         'intro': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
                  'Sample text Sample text.',
         'actions': [{'id': 'm08_a1',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm08_a2', 'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm08_a3', 'text': 'Sample text Sample text Sample text Sample text Sample text.'},
                     {'id': 'm08_a4',
                      'text': 'Sample text Sample text Sample text Sample text Sample text Sample text '
                              'Sample.'}],
         'blocks': [{'type': 'pipeline_prompts', 'resource': 'res_10'},
                    {'type': 'callout',
                     'tone': 'note',
                     'title': 'Sample text Sample text Samp.',
                     'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text Sample text Sample text Sample text Sample text Sample text Sample '
                             'text.'}]}}

COMMITMENTS = {'title': 'Sample label label',
 'question': 'Sample text Sample text Sample text Sample text Samp.',
 'guide': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Samp.',
 'examples': ['Sample text Sample text Sample text Sample text Sample text Sample t.',
              'Sample text Sample text Sample text Sample text Sample te.',
              'Sample text Sample text Sample text Sample text Sample text Sample text Sample t.',
              'Sample text Sample text Sample text Sample text Sample text Sample te.']}

CASE_EXAMPLE = {'headline': 'Sample text Sample text Sample text Sample te.',
 'note': 'Sample text Sample text Sample text Sample text Sample.',
 'stats': [['Sample label', 'Sample'],
           ['Sample label', 'Sample'],
           ['Sample label label', 'Sample'],
           ['Sample label', 'Sample label']],
 'challenge': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample '
              'text Sample text Sample text Sample text Sample text Sample text Sample text.',
 'strategy': [['Sample text Sample text S.',
               'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample '
               'text Sample text Sample t.'],
              ['Sample text Sample tex.',
               'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample '
               'text.'],
              ['Sample label label',
               'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample '
               'text Sample t.']],
 'result': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sampl.',
 'quote': 'Sample text Sample text Sample text Sample text Sam.'}

TOUCHES = [{'tag': 'Sample label',
  'title': 'Sample label',
  'when': 'Sample label',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text.',
  'note': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sample text Sample text Sample t.'},
 {'tag': 'Sample label',
  'title': 'Sample label',
  'when': 'Sample label label',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text.',
  'note': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text Sample text Sampl.'}]

ASSISTANT_FLOW = {'q1': 'Sample text Sample text Sample.',
 'q2': 'Sample text Sample text Sample text Sample t.',
 'no1_title': 'Sample text Sample text Sample t.',
 'no1_text': 'Sample text Sample text Sample text Sample text Sa.',
 'no1_resource': 'res_08',
 'no2_title': 'Sample text Sample text Sample text Samp.',
 'no2_text': 'Sample text Sample text Sample text Sample text Sample text Samp.',
 'no2_resource': 'res_09',
 'ready_title': 'Sample label',
 'ready_text': 'Sample text Sample text Sample text Sample text.'}

HOW_TO = [{'title': 'Sample text Sample te.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text.',
  'icon': 'web'},
 {'title': 'Sample text Sample te.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample.',
  'icon': 'pdf'},
 {'title': 'Sample text Sample text Sa.',
  'text': 'Sample text Sample text Sample text Sample text Sample text Sample text Sample text Sample text '
          'Sample text.',
  'icon': 'sheet'}]

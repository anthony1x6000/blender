import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { apply, internals } from '../index.js'

test('preview driver avoids World.use_nodes deprecation warning on Blender 5+', async () => {
  const source = await readFile(new URL('../scripts/dsh_blender_driver.py', import.meta.url), 'utf8')
  assert.doesNotMatch(
    source,
    /scene\.world = bpy\.data\.worlds\.new\([^\n]+\)\s*\n\s*scene\.world\.use_nodes\s*=\s*True\s*$/mu,
    'driver must not unconditionally set World.use_nodes after creating/finding a world (deprecated warning in Blender 5.x; removal path in 6.0)',
  )
  assert.match(source, /getattr\(scene\.world, "node_tree", None\) is None/u, 'driver should guard legacy use_nodes fallback on missing node_tree')
  assert.match(source, /Blender 6\.0/u, 'compatibility comment should document the removal path')
})

test('analysis setup hint is actionable when dependencies are unavailable', () => {
  const hint = internals.analysisSetupHint('/usr/bin/python3')
  assert.match(hint, /setup-analysis\.js/u)
  assert.match(hint, /requirements-analysis\.txt/u)
  assert.match(hint, /DSH_BLENDER_ANALYSIS_PYTHON|analysisPythonExecutable/u)
  assert.match(hint, /opencv-python-headless/u)
})

test('validation summary compacts errors/warnings for tool output', () => {
  const summary = internals.summarizeValidation({
    passed: false,
    errors: [{ object: 'A', code: 'bad' }, { object: 'B', code: 'worse', message: 'detail' }],
    warnings: [{ object: 'C', code: 'missing-uv' }],
    objects: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  }, { profile: 'web' })
  assert.deepEqual(summary, {
    profile: 'web',
    passed: false,
    errorCount: 2,
    warningCount: 1,
    objectCount: 3,
    topErrors: [{ object: 'A', code: 'bad' }, { object: 'B', code: 'worse', message: 'detail' }],
    topWarnings: [{ object: 'C', code: 'missing-uv' }],
  })
})

test('validation tools declare and return summary fields', () => {
  const tools = []
  apply({
    tools: { register(tool) { tools.push(tool) } },
    skills: { register() {} },
  }, {
    blenderExecutable: 'blender',
    analysisPythonExecutable: '',
    timeoutMs: 180000,
    helperTimeoutMs: 120000,
    maxOutputChars: 20000,
    restrictToWorkspace: true,
    enablePython: true,
    enableHelpers: true,
    enableMaintenanceHelpers: false,
    registerSkill: true,
    registerModuleSkills: true,
  })
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  for (const name of ['blender_validate_scene', 'blender_validate_export']) {
    const tool = byName.get(name)
    assert.ok(tool, `${name} must be registered`)
    assert.equal(tool.output?.schema?.properties?.summary?.required, true, `${name} schema must require summary`)
  }
})

test('blender_status and helper_catalog schemas accept analysis hint metadata', () => {
  const tools = []
  apply({
    tools: { register(tool) { tools.push(tool) } },
    skills: { register() {} },
  }, {
    blenderExecutable: 'blender',
    analysisPythonExecutable: '',
    timeoutMs: 180000,
    helperTimeoutMs: 120000,
    maxOutputChars: 20000,
    restrictToWorkspace: true,
    enablePython: true,
    enableHelpers: true,
    enableMaintenanceHelpers: false,
    registerSkill: false,
    registerModuleSkills: false,
  })
  const byName = new Map(tools.map((tool) => [tool.name, tool]))
  assert.equal(byName.get('blender_status').output.schema.properties.analysis.additionalProperties, true)
  assert.equal(byName.get('blender_helper_catalog').output.schema.properties.analysis.additionalProperties, true)
})

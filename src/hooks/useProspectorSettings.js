import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { prepareSettingsForSave, prospectorErrorMessage } from '../lib/prospector/settings.js'

export function useProspectorSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const generation = useRef(0)
  const savePending = useRef(false)
  const reload = useCallback(async () => {
    const current = ++generation.current
    setLoading(true); setError(null)
    try {
      const result = await supabase.from('prospector_settings').select('*').eq('id','main').single()
      if (result.error) throw result.error
      if (current === generation.current) setSettings(result.data)
    } catch (error) { if (current === generation.current) setError(prospectorErrorMessage(error)) }
    finally { if (current === generation.current) setLoading(false) }
  }, [])
  useEffect(() => { reload(); return () => { generation.current++ } }, [reload])
  const save = async form => {
    if (savePending.current || !settings) return null
    let payload
    try { payload = prepareSettingsForSave(form, settings) }
    catch (error) { setError(error.message); return null }
    const current = generation.current
    savePending.current = true; setSaving(true); setError(null)
    try {
      const result = await supabase.rpc('prospector_save_settings', { p_settings: payload, p_expected_updated_at: settings.updated_at })
      if (result.error) throw result.error
      if (current === generation.current) setSettings(result.data)
      return result.data
    } catch (error) { if (current === generation.current) setError(prospectorErrorMessage(error)); return null }
    finally { savePending.current = false; if (current === generation.current) setSaving(false) }
  }
  return { settings, loading, saving, error, reload, save }
}

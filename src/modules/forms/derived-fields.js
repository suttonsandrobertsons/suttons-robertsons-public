import { formValues } from './core/fields.js'

function fieldType(control) {
  return String(
    control.closest('[data-form-field-type]')?.getAttribute('data-form-field-type')
    || control.getAttribute('data-form-field-type')
    || '',
  ).trim().toLowerCase()
}

function fieldKey(control) {
  return String(
    control.closest('[data-form-field]')?.getAttribute('data-form-field')
    || control.getAttribute('data-form-field')
    || control.name
    || '',
  ).trim()
}

function setHidden(root, name, value) {
  formValues.setHidden(root, name, value || '')
}

export function formatDate(value) {
  const date = String(value || '').trim()
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return ''

  return `${match[1]}-${match[2]}-${match[3]}`
}

export function formatTime(value) {
  const time = String(value || '').trim()
  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return ''

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || 0)
  if (hour > 23 || minute > 59 || second > 59) return ''

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

export const formDerivedFields = {
  apply(root) {
    if (!root?.querySelectorAll) return

    root.querySelectorAll('input, select, textarea').forEach((control) => {
      const type = fieldType(control)
      if (type !== 'date' && type !== 'time') return

      const key = fieldKey(control)
      if (!key) return

      const value = type === 'date' ? formatDate(control.value) : formatTime(control.value)
      setHidden(root, `${key}_formatted`, value)
    })

    deriveCombinedAssetType(root)
    deriveAppointmentDatetimes(root)
  },
}

// Zoho meetings need a start AND a mandatory end datetime in
// `YYYY-MM-DDTHH:mm:ss`. Compute both from the appointment date + time + the
// gated `appointment_length` (minutes). Kept separate from the generic date/time
// formatter above (which only reformats single fields — no arithmetic, no
// combining). Reads via get() so the home-visit path (date/time condition-hidden)
// yields nothing and we simply emit no datetimes there.
function deriveAppointmentDatetimes(root) {
  const dateStr = (formValues.get(root, 'appointment_date')[0] || '').trim()
  const timeStr = (formValues.get(root, 'appointment_time')[0] || '').trim()

  const date = formatDate(dateStr)             // '' unless valid YYYY-MM-DD
  const time = formatTime(timeStr)             // '' unless valid, normalised to HH:mm:ss
  if (!date || !time) {
    setHidden(root, 'appointment_start_datetime', '')
    setHidden(root, 'appointment_end_datetime', '')
    return
  }

  const start = `${date}T${time}`
  setHidden(root, 'appointment_start_datetime', start)

  const length = parseInt((formValues.get(root, 'appointment_length')[0] || '').trim(), 10)
  setHidden(root, 'appointment_end_datetime', Number.isFinite(length) ? addMinutes(date, time, length) : '')
}

// Add `minutes` to a `YYYY-MM-DD` + `HH:mm:ss` and return `YYYY-MM-DDTHH:mm:ss`.
// Uses UTC date arithmetic purely for a clean day-rollover (no timezone shift is
// applied to the wall-clock values themselves).
export function addMinutes(date, time, minutes) {
  const pad = (n) => String(n).padStart(2, '0')
  const [Y, Mo, D] = date.split('-').map(Number)
  const [h, m, s] = time.split(':').map(Number)

  let total = h * 60 + m + minutes
  const dayShift = Math.floor(total / 1440)
  total = ((total % 1440) + 1440) % 1440
  const eh = Math.floor(total / 60)
  const em = total % 60

  const d = new Date(Date.UTC(Y, Mo - 1, D))
  d.setUTCDate(d.getUTCDate() + dayShift)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(eh)}:${pad(em)}:${pad(s || 0)}`
}

// Coalesce the asset picker into a single value for Zoho's Asset_Type field:
// when the asset is "Other", take the other_asset_types sub-type; otherwise the
// main category. This ONLY picks between the two existing values — both already
// emit the exact Zoho option strings (aligned at source in the CMS), so there's
// no translation here and nothing to drift. Lets Zapier map one field with no
// Formatter/lookup step. other_asset_types reads empty unless it's visible
// (get() skips condition-hidden fields), so a stale sub-type can't leak through.
function deriveCombinedAssetType(root) {
  const assetType = (formValues.get(root, 'asset_type')[0] || '').trim()
  if (!assetType) return

  const otherType = (formValues.get(root, 'other_asset_types')[0] || '').trim()
  const combined = assetType === 'Other' ? otherType : assetType
  setHidden(root, 'combined_asset_type', combined)
}

/** Keep stored dates in ISO format while copying the portal's day/month/year format. */
export function certificateFieldCopyValue(value: string, isDate: boolean) {
  if (!isDate) return value

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value

  return `${match[3]}/${match[2]}/${match[1]}`
}

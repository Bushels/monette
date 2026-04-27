"""Add `unmappedAc` field to each propertySummary block.

Computes unmappedAc = max(0, propertySummary.farmedAc - prop.titled).
For properties with no XLSX coverage (cabri-bank, rosetown), unmapped = farmedAc.
"""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')

DATA_PATH = r'C:/Users/kyle/Agriculture/Monette/data.js'
with open(DATA_PATH, encoding='utf-8') as f:
    txt = f.read()

# Find each property entry, extract id, titled, and the propertySummary's farmedAc.
# Then insert unmappedAc:N into the propertySummary block.

# Match each property block roughly (loose because we just need id+titled+ps farmedAc).
# Use a state-machine approach: find each `id:"<x>"`, then within that property:
#   - read titled:N
#   - find propertySummary:{ ... farmedAc:N ... }
#   - insert unmappedAc:M after farmedAc

# Iterate property entries.
prop_pattern = re.compile(r'id:"([a-z\-]+)"')
positions = [(m.start(), m.group(1)) for m in prop_pattern.finditer(txt)]
# Filter out sold-* entries.
positions = [(p, pid) for p, pid in positions if not pid.startswith('sold-')]

# For each property, find its enclosing brace span. Assume `{ id:"..."` opens
# the entry and the matching `}` closes it.
edits = []  # (insert_pos, text_to_insert)
audit = []
for pos, pid in positions:
    # Find the opening { just before pos
    open_brace = txt.rfind('{', 0, pos)
    # Find matching }
    depth = 1
    i = open_brace + 1
    while i < len(txt) and depth > 0:
        if txt[i] == '{': depth += 1
        elif txt[i] == '}': depth -= 1
        i += 1
    end_of_entry = i  # right after closing }
    block = txt[open_brace:end_of_entry]
    # Extract titled:N
    m_titled = re.search(r'titled:(\d+)', block)
    titled = int(m_titled.group(1)) if m_titled else 0
    # Find the propertySummary block within this property
    m_ps = re.search(r'propertySummary:\{', block)
    if not m_ps:
        audit.append(f"  {pid:<14} no propertySummary -> skip")
        continue
    # Within block, find farmedAc:N
    m_farmed = re.search(r'farmedAc:(\d+)', block[m_ps.start():])
    if not m_farmed:
        audit.append(f"  {pid:<14} propertySummary has no farmedAc -> skip")
        continue
    farmed = int(m_farmed.group(1))
    unmapped = max(0, farmed - titled)
    if unmapped == 0:
        audit.append(f"  {pid:<14} farmed {farmed} <= titled {titled} -> no gap, skip")
        continue
    # Compute insertion: right after the farmedAc line, before the next field
    farmed_abs_start = open_brace + m_ps.start() + m_farmed.start()
    farmed_abs_end = open_brace + m_ps.start() + m_farmed.end()
    # The line ends with "," after the digits — find next char after match
    # Actually m_farmed.end() points right after the digits. Need to skip the trailing comma.
    abs_after = farmed_abs_end
    if abs_after < len(txt) and txt[abs_after] == ',':
        abs_after += 1
    # Insert "\n        unmappedAc:N,"
    insertion = f"\n        unmappedAc:{unmapped},"
    edits.append((abs_after, insertion))
    audit.append(f"  {pid:<14} titled {titled:>6}  farmed {farmed:>6}  unmapped {unmapped:>6}  -> add unmappedAc:{unmapped}")

# Apply edits in reverse so positions don't shift
edits.sort(key=lambda x: -x[0])
for pos, ins in edits:
    txt = txt[:pos] + ins + txt[pos:]

# Sanity
opens = txt.count('{')
closes = txt.count('}')

with open(DATA_PATH, 'w', encoding='utf-8') as f:
    f.write(txt)

print("Per-property unmapped audit:")
for line in audit: print(line)
print(f"\nApplied {len(edits)} edits.")
print(f"Brace balance: {opens} opens / {closes} closes (delta {opens-closes})")

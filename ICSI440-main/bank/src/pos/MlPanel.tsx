import type { Health, MlReport } from '../api'
import { CheckIcon, XIcon } from '../components/Icons'

interface MlPanelProps {
  report: MlReport | null
  health: Health | null
  offline: boolean
  showMesh: boolean
  onToggleMesh: (value: boolean) => void
}

const STEP_NAMES: Record<string, string> = {
  center: 'Эгц',
  turn_left: 'Зүүн',
  turn_right: 'Баруун',
  look_up: 'Дээш',
  look_down: 'Доош',
  blink: 'Анивчих',
}

const PIPELINE = [
  ['Браузер', 'MediaPipe Face Landmarker — 478 цэг, толгойн байрлал, анивчилт. Заавар өгч, зөв мөчид зураг авна.'],
  ['Илрүүлэлт', 'SCRFD-10G — нүүр ба 5 цэг (нүд, хамар, ам)'],
  ['Чанар', 'eDifFIQA — зургийн чанарын үнэлгээ, бүдэг/харанхуй зургийг шүүнэ'],
  ['Амьд байдал', 'MiniFASNet V2 + V1SE — хэвлэсэн зураг, дэлгэц, маскийг илрүүлнэ'],
  ['Даалгавар', 'HeadPose + FaceAttribNet — эргэлт, анивчилтыг сервер дахин хэмжинэ'],
  ['Таних', 'AdaFace IR-50 — 512 хэмжээст вектор, MongoDB дахь загваруудтай косинус төстэй байдал (1:N)'],
  ['2-р хүчин зүйл', 'ПИН код (scrypt hash), 5 буруу оролдлогоор түгжинэ'],
]

function Bar({ value, threshold, label }: { value: number; threshold: number; label: string }) {
  const ok = value >= threshold
  return (
    <div>
      <div className="flex justify-between text-[12px] font-bold">
        <span className="text-[#6b7684]">{label}</span>
        <span className={ok ? 'text-[#1b7f43]' : 'text-[#f04452]'}>
          {value.toFixed(3)} <span className="font-semibold text-[#8b95a1]">/ {threshold}</span>
        </span>
      </div>
      <div className="relative mt-[5px] h-[8px] rounded-full bg-[#eef1f5]">
        <div
          className={`h-full rounded-full ${ok ? 'bg-[#22c55e]' : 'bg-[#f04452]'}`}
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
        <div className="absolute -top-[3px] h-[14px] w-[2px] bg-[#191f28]" style={{ left: `${threshold * 100}%` }} />
      </div>
    </div>
  )
}

const fmt = (n: number | null | undefined, digits = 0) => {
  if (n === null || n === undefined) return '—'
  const text = n.toFixed(digits)
  return Number(text) === 0 ? (0).toFixed(digits) : text // no "-0"
}

/** Live view of what the ML pipeline measured - for explaining the system in class. */
export default function MlPanel({ report, health, offline, showMesh, onToggleMesh }: MlPanelProps) {
  return (
    <section className="rounded-[24px] bg-white p-[18px] shadow-[0_8px_30px_rgba(15,30,70,.08)]">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8b95a1]">ML дэлгэрэнгүй</div>
      <h2 className="mt-[2px] text-[18px] font-extrabold">Таних ба амьд байдлын шалгалт</h2>

      <div className="mt-[12px] flex flex-wrap gap-[6px] text-[11.5px] font-bold">
        {[
          ['API', !offline && !!health],
          ['MongoDB', !!health?.db],
          ['AI загвар', !!health?.models_ready],
        ].map(([name, ok]) => (
          <span
            key={name as string}
            className={`flex items-center gap-[5px] rounded-full px-[9px] py-[4px] ${ok ? 'bg-[#e3f6ea] text-[#1b7f43]' : 'bg-[#fff0f0] text-[#d92d3a]'}`}
          >
            <span className={`size-[6px] rounded-full ${ok ? 'bg-[#22c55e]' : 'bg-[#f04452]'}`} />
            {name}
          </span>
        ))}
      </div>
      {offline && (
        <p className="mt-[10px] rounded-[12px] bg-[#fff4e5] p-[10px] text-[12px] font-semibold leading-[18px] text-[#9a5b00]">
          Сервер ажиллахгүй байна: <code>cd biometric-payment && python app.py</code>
        </p>
      )}

      <label className="mt-[14px] flex cursor-pointer items-center justify-between rounded-[14px] bg-[#f7f8fa] px-[14px] py-[11px] text-[13px] font-bold">
        Face mesh харуулах (MediaPipe)
        <input
          type="checkbox"
          checked={showMesh}
          onChange={(e) => onToggleMesh(e.target.checked)}
          className="size-[18px] accent-[#22529f]"
        />
      </label>

      {!report ? (
        <ol className="mt-[16px] space-y-[10px]">
          {PIPELINE.map(([title, text], i) => (
            <li key={title} className="flex gap-[10px] text-[12.5px] leading-[18px]">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-extrabold text-brand">
                {i + 1}
              </span>
              <span>
                <b className="text-[#191f28]">{title}.</b> <span className="text-[#6b7684]">{text}</span>
              </span>
            </li>
          ))}
          <li className="pt-[4px] text-[12px] font-medium text-[#8b95a1]">
            Терминал дээр төлбөр хийхэд хэмжсэн утгууд энд гарна.
          </li>
        </ol>
      ) : (
        <div className="mt-[16px] space-y-[16px]">
          <div className="space-y-[10px]">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-extrabold">Амьд байдал</h3>
              <span
                className={`rounded-full px-[9px] py-[3px] text-[11px] font-extrabold ${report.liveness.passed ? 'bg-[#e3f6ea] text-[#1b7f43]' : 'bg-[#fff0f0] text-[#d92d3a]'}`}
              >
                {report.liveness.passed ? 'ТЭНЦСЭН' : `ТЭНЦЭЭГҮЙ · ${report.liveness.reason}`}
              </span>
            </div>
            <Bar
              label="P(real) дундаж — MiniFASNet"
              value={report.liveness.passive}
              threshold={health?.thresholds.liveness ?? 0.7}
            />
            <Bar
              label="Ижил хүн (кадр хоорондын төстэй байдал)"
              value={report.liveness.consistency_min}
              threshold={0.4}
            />
            <div className="grid grid-cols-3 gap-[6px]">
              {report.liveness.checks.map((c) => (
                <div key={c.step} className="rounded-[12px] bg-[#f7f8fa] px-[8px] py-[7px] text-[11px]">
                  <div className="flex items-center gap-[4px] font-extrabold">
                    {c.passed ? (
                      <CheckIcon size={12} strokeWidth={3} className="text-[#22c55e]" />
                    ) : (
                      <XIcon size={12} strokeWidth={3} className="text-[#f04452]" />
                    )}
                    {STEP_NAMES[c.step] ?? c.step}
                  </div>
                  <div className="mt-[2px] font-semibold text-[#8b95a1]">
                    {fmt(c.measured, c.step === 'blink' ? 2 : 0)}
                    {c.step === 'blink' || c.step === 'center' ? '' : '°'} · {c.required}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {report.match && (
            <div className="space-y-[10px]">
              <h3 className="text-[14px] font-extrabold">Таних (1:N)</h3>
              <Bar label="Косинус төстэй байдал" value={report.match.score} threshold={report.match.threshold} />
              <Bar label="Дараагийн хүнээс зөрүү" value={report.match.margin} threshold={report.match.min_margin} />
              <div className="flex flex-wrap gap-[6px] text-[11.5px] font-bold">
                {report.match.top.map((t, i) => (
                  <span
                    key={t.name}
                    className={`rounded-full px-[9px] py-[4px] ${i === 0 ? 'bg-brand text-white' : 'bg-[#f2f4f6] text-[#4e5968]'}`}
                  >
                    {t.name} {t.score.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[14px] font-extrabold">Кадр тус бүр</h3>
            <div className="mt-[8px] overflow-x-auto">
              <table className="w-full text-left text-[11.5px] tabular-nums">
                <thead className="text-[#8b95a1]">
                  <tr>
                    {['Алхам', 'P(real)', 'yaw', 'pitch', 'нүд', 'чанар', 'ms'].map((h) => (
                      <th key={h} className="pb-[4px] pr-[6px] font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-semibold">
                  {report.frames.map((f) => (
                    <tr key={f.step} className="border-t border-[#f2f4f6]">
                      <td className="py-[5px] pr-[6px]">{STEP_NAMES[f.step] ?? f.step}</td>
                      <td className="pr-[6px]">{fmt(f.liveness, 2)}</td>
                      <td className="pr-[6px]">{fmt(f.yaw)}°</td>
                      <td className="pr-[6px]">{fmt(f.pitch)}°</td>
                      <td className="pr-[6px]">{fmt(f.eyes_open, 2)}</td>
                      <td className="pr-[6px]">{fmt(f.quality, 2)}</td>
                      <td>{Math.round(Object.values(f.ms).reduce((a, b) => a + b, 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.ms_total !== undefined && (
              <p className="mt-[6px] text-[11.5px] font-semibold text-[#8b95a1]">
                Серверийн нийт хугацаа: {report.ms_total} ms
              </p>
            )}
          </div>

          <div className="space-y-[3px] rounded-[14px] bg-[#f7f8fa] p-[12px] text-[11.5px]">
            {Object.entries(report.models).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="font-bold text-[#8b95a1]">{k}</span>
                <span className="text-right font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

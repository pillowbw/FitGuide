import { useState } from 'react'

/**
 * 成员 B：正反面肌肉热区图
 * props:
 * - side: 'front' | 'back'
 * - muscles: muscles.json 过滤后的数组
 * - onSelect: (muscleId) => void
 */
export default function MuscleMap({ side = 'front', muscles = [], onSelect }) {
  const [hovered, setHovered] = useState(null)

  const muscleNames = muscles.reduce((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})

  function handleClick(muscleId) {
    onSelect?.(muscleId)
  }

  return (
    <div className="muscle-map" data-side={side}>
      {/* 悬停提示 */}
      {hovered && (
        <div className="muscle-map-tooltip">
          {muscleNames[hovered] || hovered}
        </div>
      )}

      {/* 整体容器：背景解剖图 + 前景热区 */}
      <div className="muscle-map-stage">
        {/* 背景：真实解剖图（低透明度） */}
        <div className="muscle-map-bg">
          <img
            src={side === 'front' ? '/body/front.jpg' : '/body/back.jpg'}
            alt=""
            className="muscle-bg-img"
            aria-hidden="true"
          />
        </div>

        {/* 前景：可点击热区 SVG */}
        {/* viewBox 300×739 对应图片渲染尺寸 300px宽 × 739px高 */}
        <svg
          viewBox="0 0 300 739"
          xmlns="http://www.w3.org/2000/svg"
          className="muscle-hotspots-svg"
          aria-label={`人体${side === 'front' ? '正面' : '背面'}肌肉热区图`}
        >
          {side === 'front' ? (
            <FrontHotspots hovered={hovered} onHover={setHovered} onClick={handleClick} />
          ) : (
            <BackHotspots hovered={hovered} onHover={setHovered} onClick={handleClick} />
          )}
        </svg>
      </div>

      {/* 侧边图例 */}
      <div className="muscle-map-legend">
        {muscles
          .filter((m) => m.side === side)
          .map((m) => (
            <button
              key={m.id}
              type="button"
              className={`legend-item${hovered === m.id ? ' is-hovered' : ''}`}
              onClick={() => handleClick(m.id)}
              onMouseEnter={() => setHovered(m.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="legend-dot" data-region={m.region} />
              {m.name}
            </button>
          ))}
      </div>
    </div>
  )
}

function makePath(id, d, region, hovered, onHover, onClick, keySuffix = '') {
  return (
    <path
      key={`${id}${keySuffix}`}
      d={d}
      className={`muscle-hotspot${hovered === id ? ' is-hovered' : ''} region-${region}`}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(id)}
    />
  )
}

function FrontHotspots({ hovered, onHover, onClick }) {
  return (
    <g className="front-hotspots">
      {/* 胸大肌 chest */}
      {makePath('chest',
        'M106 132 C106 118 116 108 130 104 C144 100 156 100 170 104 C184 108 194 118 194 132 C194 150 186 168 174 182 C162 196 150 200 150 200 C150 200 138 196 126 182 C114 168 106 150 106 132 Z',
        'upper', hovered, onHover, onClick)}
      {/* 左三角肌 */}
      {makePath('shoulders',
        'M76 126 C66 126 56 134 50 146 C44 158 46 174 56 186 C66 198 82 204 96 200 C106 196 112 186 114 174 C116 162 110 146 100 136 C92 128 84 126 76 126 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右三角肌 */}
      {makePath('shoulders',
        'M224 126 C234 126 244 134 250 146 C256 158 254 174 244 186 C234 198 218 204 204 200 C194 196 188 186 186 174 C184 162 190 146 200 136 C208 128 216 126 224 126 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 左二头肌 */}
      {makePath('biceps',
        'M60 188 C52 192 48 204 50 218 C52 232 60 246 72 256 C84 264 98 262 106 252 C112 242 110 224 104 208 C98 192 86 180 74 178 C66 176 62 182 60 188 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右二头肌 */}
      {makePath('biceps',
        'M240 188 C248 192 252 204 250 218 C248 232 240 246 228 256 C216 264 202 262 194 252 C188 242 190 224 196 208 C202 192 214 180 226 178 C234 176 238 182 240 188 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 左前臂 */}
      {makePath('forearms',
        'M46 258 C38 262 34 274 36 288 C38 302 46 316 58 326 C70 334 86 332 96 322 C102 312 100 296 94 282 C88 268 76 258 64 256 C56 254 50 256 46 258 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右前臂 */}
      {makePath('forearms',
        'M254 258 C262 262 266 274 264 288 C262 302 254 316 242 326 C230 334 214 332 204 322 C198 312 200 296 206 282 C212 268 224 258 236 256 C244 254 250 256 254 258 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 腹直肌 */}
      {makePath('abs',
        'M120 206 C116 204 116 214 118 230 C120 246 124 264 130 280 C136 296 144 308 150 312 C156 308 164 296 170 280 C176 264 180 246 182 230 C184 214 184 204 180 206 C176 210 174 226 172 244 C170 262 166 278 160 290 C154 302 146 308 150 314 C154 308 162 302 168 290 C174 278 178 262 180 244 C182 226 180 210 176 206 C172 202 168 206 166 220 C164 234 160 252 156 266 C152 278 146 286 150 292 C146 286 140 278 136 266 C132 252 128 234 126 220 C124 206 122 202 120 206 Z',
        'core', hovered, onHover, onClick)}
      {/* 左腹斜肌 */}
      {makePath('obliques',
        'M104 208 C96 208 90 218 88 234 C86 252 90 274 98 292 C106 308 118 318 130 320 C138 320 144 312 144 298 C144 282 136 264 126 248 C116 232 106 216 104 208 Z',
        'core', hovered, onHover, onClick, '-L')}
      {/* 右腹斜肌 */}
      {makePath('obliques',
        'M196 208 C204 208 210 218 212 234 C214 252 210 274 202 292 C194 308 182 318 170 320 C162 320 156 312 156 298 C156 282 164 264 174 248 C184 232 194 216 196 208 Z',
        'core', hovered, onHover, onClick, '-R')}
      {/* 左股四头肌 */}
      {makePath('quads',
        'M108 324 C100 330 96 348 96 368 C96 390 100 414 108 436 C116 456 130 472 146 480 C156 484 164 478 168 462 C172 444 170 422 166 400 C162 378 158 358 152 340 C146 326 136 318 124 320 C116 322 110 322 108 324 Z',
        'lower', hovered, onHover, onClick, '-L')}
      {/* 右股四头肌 */}
      {makePath('quads',
        'M192 324 C200 330 204 348 204 368 C204 390 200 414 192 436 C184 456 170 472 154 480 C144 484 136 478 132 462 C128 444 130 422 134 400 C138 378 142 358 148 340 C154 326 164 318 176 320 C184 322 190 322 192 324 Z',
        'lower', hovered, onHover, onClick, '-R')}
    </g>
  )
}

/* ─── 背面热区 ─── */
function BackHotspots({ hovered, onHover, onClick }) {
  return (
    <g className="back-hotspots">
      {/* 斜方肌 */}
      {makePath('traps',
        'M126 94 C120 88 112 84 106 86 C98 90 92 98 90 110 C88 124 94 140 106 154 C118 168 134 176 150 178 C166 176 182 168 194 154 C206 140 212 124 210 110 C208 98 202 90 194 86 C188 84 180 88 174 94 C168 100 160 104 150 104 C140 104 132 100 126 94 Z',
        'upper', hovered, onHover, onClick)}
      {/* 左三角肌后束 */}
      {makePath('shoulders',
        'M70 136 C60 138 52 148 48 162 C44 176 48 192 58 206 C68 220 84 228 100 226 C112 222 120 212 122 198 C124 182 116 164 104 150 C92 136 80 134 70 136 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右三角肌后束 */}
      {makePath('shoulders',
        'M230 136 C240 138 248 148 252 162 C256 176 252 192 242 206 C232 220 216 228 200 226 C188 222 180 212 178 198 C176 182 184 164 196 150 C208 136 220 134 230 136 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 左背阔肌 */}
      {makePath('lats',
        'M102 176 C94 178 86 188 82 204 C78 222 82 244 92 266 C102 288 116 308 132 320 C144 328 156 326 160 312 C162 296 156 274 146 252 C136 230 122 212 112 196 C106 186 102 180 102 176 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右背阔肌 */}
      {makePath('lats',
        'M198 176 C206 178 214 188 218 204 C222 222 218 244 208 266 C198 288 184 308 168 320 C156 328 144 326 140 312 C138 296 144 274 154 252 C164 230 178 212 188 196 C194 186 198 180 198 176 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 左肱三头肌 */}
      {makePath('triceps',
        'M56 206 C48 210 42 222 42 236 C42 252 50 268 62 280 C74 292 90 296 104 290 C114 284 120 272 118 258 C116 242 106 224 92 210 C78 196 66 200 56 206 Z',
        'upper', hovered, onHover, onClick, '-L')}
      {/* 右肱三头肌 */}
      {makePath('triceps',
        'M244 206 C252 210 258 222 258 236 C258 252 250 268 238 280 C226 292 210 296 196 290 C186 284 180 272 182 258 C184 242 194 224 208 210 C222 196 234 200 244 206 Z',
        'upper', hovered, onHover, onClick, '-R')}
      {/* 竖脊肌 */}
      {makePath('lowerback',
        'M126 230 C122 234 120 248 120 264 C120 282 126 302 136 320 C146 338 158 348 168 342 C178 336 182 318 180 298 C178 278 172 258 164 244 C156 230 142 224 134 228 C128 230 126 230 126 230 Z',
        'core', hovered, onHover, onClick)}
      {/* 左臀大肌 */}
      {makePath('glutes',
        'M104 368 C96 374 92 390 96 410 C100 432 112 456 132 470 C150 482 162 478 166 460 C168 442 162 420 150 400 C138 380 122 366 112 364 C106 364 104 368 104 368 Z',
        'lower', hovered, onHover, onClick, '-L')}
      {/* 右臀大肌 */}
      {makePath('glutes',
        'M196 368 C204 374 208 390 204 410 C200 432 188 456 168 470 C150 482 138 478 134 460 C132 442 138 420 150 400 C162 380 178 366 188 364 C194 364 196 368 196 368 Z',
        'lower', hovered, onHover, onClick, '-R')}
      {/* 左腘绳肌 */}
      {makePath('hamstrings',
        'M106 486 C98 492 94 510 96 530 C98 552 106 574 118 592 C130 608 148 614 160 606 C168 598 170 578 166 556 C162 534 154 514 144 496 C132 480 118 476 106 486 Z',
        'lower', hovered, onHover, onClick, '-L')}
      {/* 右腘绳肌 */}
      {makePath('hamstrings',
        'M194 486 C202 492 206 510 204 530 C202 552 194 574 182 592 C170 608 152 614 140 606 C132 598 130 578 134 556 C138 534 146 514 156 496 C168 480 182 476 194 486 Z',
        'lower', hovered, onHover, onClick, '-R')}
      {/* 左小腿 */}
      {makePath('calves',
        'M106 610 C98 616 96 632 98 650 C100 670 108 690 120 706 C132 720 148 720 154 706 C160 690 156 668 150 648 C144 628 136 614 124 608 C116 606 110 608 106 610 Z',
        'lower', hovered, onHover, onClick, '-L')}
      {/* 右小腿 */}
      {makePath('calves',
        'M194 610 C202 616 204 632 202 650 C200 670 192 690 180 706 C168 720 152 720 146 706 C140 690 144 668 150 648 C156 628 164 614 176 608 C184 606 190 608 194 610 Z',
        'lower', hovered, onHover, onClick, '-R')}
    </g>
  )
}

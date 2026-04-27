import { useState } from 'react';

export default function Quiz({ question, options, correct, explanation, type = 'number' }) {
  const [value, setValue]       = useState('');
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const isMulti = Array.isArray(options);

  const isCorrect = () => {
    if (isMulti)          return selected === correct;
    if (type === 'number') return parseFloat(value) === parseFloat(correct);
    return value.trim().toLowerCase() === String(correct).trim().toLowerCase();
  };

  const canSubmit = isMulti ? selected !== null : value.trim() !== '';

  const submit = () => { if (canSubmit) setSubmitted(true); };

  const reset = () => { setValue(''); setSelected(null); setSubmitted(false); };

  const correct_ = submitted && isCorrect();
  const wrong_   = submitted && !isCorrect();

  return (
    <div className="quiz-root">
      <div className="quiz-header">
        <span className="quiz-label">⚡ Check your understanding</span>
      </div>

      <div className="quiz-body">
        <p className="quiz-question">{question}</p>

        {isMulti ? (
          <>
            <div className="quiz-options">
              {options.map((opt, i) => (
                <button
                  key={i}
                  className={[
                    'quiz-option',
                    selected === i                              ? 'selected' : '',
                    submitted && i === correct                  ? 'correct'  : '',
                    submitted && selected === i && i !== correct ? 'wrong'   : '',
                  ].join(' ')}
                  onClick={() => !submitted && setSelected(i)}
                  disabled={submitted}
                >
                  <span className="quiz-option-bullet">
                    {['A','B','C','D','E'][i]}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
            {!submitted && (
              <button className="quiz-submit" onClick={submit} disabled={!canSubmit}>
                Check →
              </button>
            )}
          </>
        ) : (
          <div className="quiz-input-row">
            <input
              type={type === 'number' ? 'number' : 'text'}
              className={`quiz-input${correct_ ? ' correct' : wrong_ ? ' wrong' : ''}`}
              value={value}
              onChange={e => !submitted && setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !submitted && submit()}
              placeholder={type === 'number' ? 'Enter a number…' : 'Your answer…'}
              disabled={submitted}
            />
            {!submitted && (
              <button className="quiz-submit" onClick={submit} disabled={!canSubmit}>
                Check →
              </button>
            )}
          </div>
        )}

        {submitted && (
          <div className={`quiz-feedback ${correct_ ? 'correct' : 'wrong'}`}>
            <span className="quiz-verdict">
              {correct_ ? '✓ Correct' : '✗ Not quite'}
            </span>
            {explanation && <p className="quiz-explanation">{explanation}</p>}
            {wrong_ && (
              <button className="quiz-retry" onClick={reset}>Try again</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

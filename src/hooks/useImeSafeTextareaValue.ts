import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type KeyboardEvent,
} from 'react';

export function isImeComposing(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return Boolean(
    event.nativeEvent.isComposing ||
      event.key === 'Process' ||
      event.keyCode === 229,
  );
}

export function useImeSafeTextareaValue(
  value: string,
  onValueChange: (value: string) => void,
) {
  const [draftValue, setDraftValue] = useState(value);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (!isComposingRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      setDraftValue(nextValue);

      if (!isComposingRef.current) {
        onValueChange(nextValue);
      }
    },
    [onValueChange],
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      const nextValue = event.currentTarget.value;
      isComposingRef.current = false;
      setDraftValue(nextValue);
      onValueChange(nextValue);
    },
    [onValueChange],
  );

  return {
    value: draftValue,
    isComposingRef,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };
}

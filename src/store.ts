import { create } from 'zustand';

interface TagValue {
  [key: string]: string;
}

interface FormulaState {
  formula: string;
  tagValues: TagValue;
  setFormula: (formula: string) => void;
  setTagValue: (tag: string, value: string) => void;
  deleteTag: (tag: string) => void;
}

const useStore = create<FormulaState>((set) => ({
  formula: '',
  tagValues: {},
  setFormula: (formula) => set({ formula }),
  setTagValue: (tag, value) => 
    set((state) => ({
      tagValues: { ...state.tagValues, [tag]: value }
    })),
  deleteTag: (tag) => 
    set((state) => {
      const { [tag]: _, ...rest } = state.tagValues;
      return { tagValues: rest };
    }),
}));

export default useStore;

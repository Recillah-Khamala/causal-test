import React, { useState, useRef, useEffect } from 'react';
import useStore from './store';
import { useQuery } from '@tanstack/react-query';
import { evaluate } from 'mathjs';

const OPERATORS = ['+', '-', '*', '/', '^', '(', ')'];

interface Suggestion {
  id: string;
  name: string;
  category: string;
  value: string | number;
}

const fetchAutocompleteSuggestions = async (): Promise<Suggestion[]> => {
  try {
    const response = await fetch('https://652f91320b8d8ddac0b2b62b.mockapi.io/autocomplete');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    console.log('🔵 API Response:', data);
    return data;
  } catch (error) {
    console.error('🔴 API Error:', error);
    return [];
  }
};

const FormulaInput = () => {
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const suggestionTableRef = useRef<HTMLDivElement>(null);
  const { formula, setFormula, tagValues, setTagValue } = useStore();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['autocomplete'],
    queryFn: fetchAutocompleteSuggestions,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (suggestions) {
      console.log('🟢 Data loaded:', { 
        suggestionsCount: suggestions.length,
        firstItem: suggestions[0],
        lastItem: suggestions[suggestions.length - 1]
      });
    }
    if (isLoading) {
      console.log('⏳ Loading data...');
    }
  }, [suggestions, isLoading]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [cursorPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle suggestion table clicks
      if (showDropdown && inputRef.current && suggestionTableRef.current) {
        if (!inputRef.current.contains(event.target as Node) && 
            !suggestionTableRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      }

      // Handle tag dropdown clicks
      if (activeDropdown) {
        const activeRef = dropdownRefs.current[activeDropdown];
        if (activeRef && !activeRef.contains(event.target as Node)) {
          const dropdownButton = document.querySelector(`[data-dropdown="${activeDropdown}"]`);
          if (!dropdownButton?.contains(event.target as Node)) {
            setActiveDropdown(null);
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown, showDropdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newPosition = e.target.selectionStart || 0;
    
    console.log('✏️ Input changed:', {
      newValue,
      cursorPosition: newPosition
    });
    
    setShowDropdown(true);
    setInput(newValue);
    setCursorPosition(newPosition);
    setFormula(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!input && formula) {
        const parts = formula.split(/([+\-*/^()])/);
        const newFormula = parts.slice(0, -1).join('');
        setFormula(newFormula);
        setInput(newFormula);
      } else if (input) {
        const newPosition = (e.target as HTMLInputElement).selectionStart || 0;
        const beforeCursor = input.slice(0, newPosition);
        const afterCursor = input.slice(newPosition);
        
        if (beforeCursor.match(/[a-zA-Z0-9\s]+$/)) {
          const tagMatch = beforeCursor.match(/[a-zA-Z0-9\s]+$/);
          if (tagMatch) {
            const tag = tagMatch[0];
            const newInput = beforeCursor.slice(0, -tag.length) + afterCursor;
            setInput(newInput);
            setFormula(newInput);
            setCursorPosition(beforeCursor.length - tag.length);
            setTagValue(tag, '');
          }
        }
      }
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
    if (e.key === 'Enter' && showDropdown && suggestions && suggestions.length > 0) {
      handleSuggestionClick(suggestions[0]);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    console.log('✨ Suggestion selected:', suggestion);
    
    const newPosition = (inputRef.current?.selectionStart || 0);
    const beforeCursor = input.slice(0, newPosition);
    const afterCursor = input.slice(newPosition);
    
    if (OPERATORS.some(op => beforeCursor.endsWith(op))) {
      const newInput = beforeCursor + suggestion.name + afterCursor;
      setInput(newInput);
      setFormula(newInput);
      setCursorPosition(newPosition + suggestion.name.length);
      setTagValue(suggestion.name, suggestion.value.toString());
    } else {
      const tagMatch = beforeCursor.match(/[a-zA-Z0-9\s]+$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        const newInput = beforeCursor.slice(0, -tag.length) + suggestion.name + afterCursor;
        setInput(newInput);
        setFormula(newInput);
        setCursorPosition(newPosition - tag.length + suggestion.name.length);
        setTagValue(suggestion.name, suggestion.value.toString());
      }
    }
    
    setShowDropdown(false);
  };

  const handleTagValueChange = (tag: string, value: string) => {
    console.log('🏷️ Tag value changed:', { tag, value });
    setTagValue(tag, value);
    setActiveDropdown(null);
  };

  const safeEvaluate = (expression: string): number => {
    expression = expression.replace(/\s+/g, '');
    
    console.log('🧮 Evaluating expression:', expression);
    
    if (!/^[0-9+\-*/(). ]*$/.test(expression)) {
      throw new Error('Invalid characters in expression');
    }

    // Validate expression completeness
    if (!/^[0-9+\-*/(). ]*[0-9)]$/.test(expression)) {
      throw new Error('Incomplete expression');
    }

    try {
      const result = evaluate(expression);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid result');
      }
      
      console.log('📊 Calculation result:', result);
      return result;
    } catch (error) {
      console.error('❌ Expression evaluation error:', error);
      throw new Error('Invalid expression');
    }
  };

  const calculateResult = () => {
    try {
      let expression = formula;
      
      console.log('🔄 Starting calculation:', {
        originalFormula: formula,
        tagValues
      });
      
      // First, replace variables that include spaces
      const variableRegex = /[a-zA-Z][a-zA-Z0-9\s]+/g;
      const variables = expression.match(variableRegex) || [];
      
      console.log('🔍 Found variables:', variables);
      
      let allVariablesReplaced = true;
      
      // Replace variables with their values
      variables.forEach(variable => {
        let valueFound = false;
        const trimmedVariable = variable.trim();
        
        // Try tagValues first
        if (tagValues[trimmedVariable]) {
          console.log('🏷️ Using tag value:', {
            variable: trimmedVariable,
            value: tagValues[trimmedVariable]
          });
          expression = expression.replace(
            new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            tagValues[trimmedVariable]
          );
          valueFound = true;
        }

        if (!valueFound) {
          allVariablesReplaced = false;
          console.log('⚠️ No value found for variable:', trimmedVariable);
        }
      });

      if (!allVariablesReplaced) {
        throw new Error('Not all variables have values');
      }

      console.log('🔁 After replacing variables:', expression);
      
      // Clean up the expression
      expression = expression.replace(/\s+/g, '');
      
      console.log('🧮 Final expression:', expression);
      
      if (!/^[0-9+\-*/(). ]*$/.test(expression)) {
        console.error('❌ Invalid characters in expression:', expression);
        throw new Error('Invalid characters in expression');
      }

      const result = safeEvaluate(expression);
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(result);
    } catch (error) {
      console.error('❌ Calculation error:', error);
      return 'Invalid expression';
    }
  };

  const renderFormulaWithDropdowns = () => {
    if (!formula) return null;

    const parts = formula.split(/([+\-*/^()])/).map((part, index) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return null;

      // If it's an operator, just render it
      if (OPERATORS.includes(trimmedPart)) {
        return <span key={index} className="mx-1">{trimmedPart}</span>;
      }

      // If it's a number, just render it
      if (!isNaN(Number(trimmedPart))) {
        return <span key={index}>{trimmedPart}</span>;
      }

      // If it's a variable/tag, render it with a dropdown
      const dropdownId = `tag-${index}`;
      return (
        <span key={index} className="inline-flex items-center bg-blue-50 rounded px-2 py-1 mr-1 my-1">
          <span className="mr-2">{trimmedPart}</span>
          <div className="relative">
            <button
              data-dropdown={dropdownId}
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
              }}
              className="text-blue-600 hover:text-blue-800 focus:outline-none inline-flex items-center"
            >
              <span className="mr-1">{tagValues[trimmedPart] || 'Select'}</span>
              <svg
                className={`w-4 h-4 transition-transform ${
                  activeDropdown === dropdownId ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {activeDropdown === dropdownId && suggestions && (
              <div
                ref={el => {
                  dropdownRefs.current[dropdownId] = el;
                  if (el) {
                    const button = document.querySelector(`[data-dropdown="${dropdownId}"]`) as HTMLElement;
                    if (button) {
                      const rect = button.getBoundingClientRect();
                      el.style.position = 'absolute';
                      el.style.top = `${rect.height + 4}px`;
                      el.style.left = '0';
                      el.style.minWidth = '120px';
                      el.style.zIndex = '9999';
                    }
                  }
                }}
                className="absolute bg-white border rounded-lg shadow-lg mt-1 py-1"
              >
                <div className="sticky top-0 bg-gray-50 border-b px-3 py-2 font-medium text-sm">
                  Select value
                </div>
                {suggestions
                  .filter(s => s.name === trimmedPart)
                  .map((suggestion, i) => (
                    <button
                      key={i}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center justify-between text-sm"
                      onClick={() => handleTagValueChange(trimmedPart, suggestion.value.toString())}
                    >
                      <span>{suggestion.value}</span>
                      {tagValues[trimmedPart] === suggestion.value.toString() && (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </span>
      );
    });

    return <div className="flex flex-wrap items-center mt-2">{parts}</div>;
  };

  return (
    <div className="p-4">
      <div className='relative'>
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Training Investment Calculator</h2>
          <p className="text-sm text-gray-600 mb-4">
            Calculate total training investment by multiplying number of courses completed with fixed course prices:
            <br />
            • Basic Courses: $500 each
            <br />
            • Intermediate Courses: $750 each
            <br />
            • Advanced Courses: $1000 each
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Example formula: (basic_courses * 500) + (intermediate_courses * 750) + (advanced_courses * 1000)
          </p>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="border p-2 w-full rounded-md"
          placeholder="Enter formula (e.g., (name 1 * 500) + (name 2 * 750) + (name 3 * 1000))"
        />
        
        {renderFormulaWithDropdowns()}
        
        {isLoading && <div className="text-sm text-gray-500">Loading suggestions...</div>}
        {showDropdown && suggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionTableRef}
            className="absolute z-10 w-full mt-1 border rounded shadow-lg bg-white max-h-60 overflow-y-auto suggestion-table"
          >
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2 text-left font-medium">Name</th>
                  <th className="p-2 text-left font-medium">Category</th>
                  <th className="p-2 text-left font-medium">Value</th>
                  <th className="p-2 text-left font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((suggestion) => (
                  <tr 
                    key={suggestion.id} 
                    onClick={() => handleSuggestionClick(suggestion)} 
                    className="cursor-pointer hover:bg-gray-100 border-b"
                  >
                    <td className="p-2 font-medium">{suggestion.name}</td>
                    <td className="p-2 text-gray-600">{suggestion.category}</td>
                    <td className="p-2 text-gray-700">{suggestion.value}</td>
                    <td className="p-2 text-gray-500">{suggestion.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {formula && (
          <div className="mt-4 p-2 bg-gray-100 rounded">
            <p>Result: {calculateResult()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormulaInput;
import { useState } from 'react';

export default function useFormFields(initialValues) {
  const [fields, setFields] = useState(initialValues);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const resetFields = () => setFields(initialValues);

  return { fields, handleChange, resetFields, setFields };
}

'use strict';

import { useContext } from 'react';
import { FormStateOwnerContext } from '../form';

export function useFormStateOwner() {
  return useContext(FormStateOwnerContext);
}

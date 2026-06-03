import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { RootState } from "./rootReducer";
import type { AppDispatch } from "./index";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

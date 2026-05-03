import type { JSX } from "react";
import type { IndentData, UserPermissions } from "./database";

export interface RouteAttributes {
    name: string;
    element: JSX.Element;
    path: string;
    icon: JSX.Element;
    gateKey?: keyof UserPermissions;
    notifications: (sheet: IndentData[]) => number
}

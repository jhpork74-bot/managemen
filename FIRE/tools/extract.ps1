$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class SkpRead {
 const string D = @"C:\Program Files\SketchUp\SketchUp 2019\SketchUpAPI.dll";
 [DllImport(D)] static extern void SUInitialize();
 [DllImport(D)] static extern int SUModelCreateFromFile(ref IntPtr m, byte[] path);
 [DllImport(D)] static extern int SUModelGetEntities(IntPtr m,out IntPtr e);
 [DllImport(D)] static extern int SUModelRelease(ref IntPtr m);
 [DllImport(D)] static extern int SUEntitiesGetNumFaces(IntPtr e,out UIntPtr n);
 [DllImport(D)] static extern int SUEntitiesGetFaces(IntPtr e,UIntPtr n,[Out] IntPtr[] f,out UIntPtr got);
 [DllImport(D)] static extern int SUFaceGetOuterLoop(IntPtr f,out IntPtr l);
 [DllImport(D)] static extern int SULoopGetNumVertices(IntPtr l,out UIntPtr n);
 [DllImport(D)] static extern int SULoopGetVertices(IntPtr l,UIntPtr n,[Out] IntPtr[] v,out UIntPtr got);
 [DllImport(D)] static extern int SUVertexGetPosition(IntPtr v,[Out] double[] p);
 [DllImport(D)] static extern int SUEntitiesGetNumGroups(IntPtr e,out UIntPtr n);
 [DllImport(D)] static extern int SUEntitiesGetGroups(IntPtr e,UIntPtr n,[Out] IntPtr[] g,out UIntPtr got);
 [DllImport(D)] static extern int SUGroupGetEntities(IntPtr g,out IntPtr e);
 [DllImport(D)] static extern int SUGroupGetTransform(IntPtr g,[Out] double[] t);
 [DllImport(D)] static extern int SUEntitiesGetNumInstances(IntPtr e,out UIntPtr n);
 [DllImport(D)] static extern int SUEntitiesGetInstances(IntPtr e,UIntPtr n,[Out] IntPtr[] g,out UIntPtr got);
 [DllImport(D)] static extern int SUComponentInstanceGetDefinition(IntPtr g,out IntPtr d);
 [DllImport(D)] static extern int SUComponentDefinitionGetEntities(IntPtr d,out IntPtr e);
 [DllImport(D)] static extern int SUComponentInstanceGetTransform(IntPtr g,[Out] double[] t);
 static double[] Identity(){var t=new double[16];t[0]=t[5]=t[10]=t[15]=1;return t;}
 static double[] Mul(double[] a,double[] b){var c=new double[16];for(int j=0;j<4;j++)for(int i=0;i<4;i++)for(int k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
 static double[] Point(double[] p,double[] t){return new[]{t[0]*p[0]+t[4]*p[1]+t[8]*p[2]+t[12],t[1]*p[0]+t[5]*p[1]+t[9]*p[2]+t[13],t[2]*p[0]+t[6]*p[1]+t[10]*p[2]+t[14]};}
 static void Walk(IntPtr e,double[] t,List<double[][]> result,int depth){
 if(depth>30)throw new Exception("Too deep");UIntPtr n,got;SUEntitiesGetNumFaces(e,out n);var fs=new IntPtr[(int)n.ToUInt64()];SUEntitiesGetFaces(e,n,fs,out got);
 foreach(var f in fs){IntPtr l=IntPtr.Zero;SUFaceGetOuterLoop(f,out l);SULoopGetNumVertices(l,out n);var vs=new IntPtr[(int)n.ToUInt64()];SULoopGetVertices(l,n,vs,out got);var ps=new List<double[]>();foreach(var v in vs){var p=new double[3];SUVertexGetPosition(v,p);ps.Add(Point(p,t));}result.Add(ps.ToArray());}
 SUEntitiesGetNumGroups(e,out n);var gs=new IntPtr[(int)n.ToUInt64()];SUEntitiesGetGroups(e,n,gs,out got);foreach(var g in gs){IntPtr child=IntPtr.Zero;var tr=new double[16];SUGroupGetEntities(g,out child);SUGroupGetTransform(g,tr);Walk(child,Mul(t,tr),result,depth+1);}
 SUEntitiesGetNumInstances(e,out n);var ins=new IntPtr[(int)n.ToUInt64()];SUEntitiesGetInstances(e,n,ins,out got);foreach(var g in ins){IntPtr d=IntPtr.Zero,child=IntPtr.Zero;var tr=new double[16];SUComponentInstanceGetDefinition(g,out d);SUComponentDefinitionGetEntities(d,out child);SUComponentInstanceGetTransform(g,tr);Walk(child,Mul(t,tr),result,depth+1);}
 }
 public static double[][][] Read(string path){SUInitialize();IntPtr m=IntPtr.Zero;int r=SUModelCreateFromFile(ref m,System.Text.Encoding.UTF8.GetBytes(path+"\0"));if(r!=0)throw new Exception("SKP read error "+r);try{IntPtr e=IntPtr.Zero;SUModelGetEntities(m,out e);var all=new List<double[][]>();Walk(e,Identity(),all,0);return all.ToArray();}finally{SUModelRelease(ref m);}}
}
'@
$outDir = Join-Path $PSScriptRoot '..\data'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
foreach ($floor in 1,2) {
 $faces = [SkpRead]::Read("C:\Users\홈\Desktop\스케치업관련\복지관 도면\${floor}층도면.skp")
 ConvertTo-Json -InputObject $faces -Depth 10 -Compress | Set-Content -Encoding utf8 (Join-Path $outDir "floor$floor-faces.json")
 Write-Output "Floor ${floor}: $($faces.Length) faces"
}


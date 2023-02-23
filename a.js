fs=require('fs/promises');
console.log('我的')
process.stdout.write(require('child_process').execSync('echo 我的'));

path=require('path');
zipFile = path.join(__dirname, 'runtime/v2ray-windows-64.zip');
extractTo = path.join(__dirname, 'runtime/v2_temp');
async function main1() {
    await fs.rm(extractTo, { force: true, recursive: true });
    require('child_process').execFile('powershell.exe', [
        '-nologo', '-noprofile', '-command',
        '& { param([String]$myInPath, [String]$myOutPath); Add-Type -A "System.IO.Compression.FileSystem"; [IO.Compression.ZipFile]::ExtractToDirectory($myInPath, $myOutPath); exit !$? }',
        '-myInPath', `"${zipFile}"`, '-myOutPath', `"${extractTo}"`,
    ], async (err) => {
        if (err) {
            console.error(err);
            return;
        }
        const files = await fs.readdir(extractTo);
        const move = (name) => {
            const src = path.join(extractTo, name);
            const dest = path.join(extractTo, '..', name);
            return fs.rename(src, dest);
        };
        await Promise.all(files.map(move));
        await fs.rm(extractTo, { force: true, recursive: true });
        console.log('ok');
    });
}
main();

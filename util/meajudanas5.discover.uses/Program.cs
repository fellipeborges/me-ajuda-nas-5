using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Text.RegularExpressions;


// Dic files
string dicFile = Path.Combine(Directory.GetCurrentDirectory(), "dic.txt");
string dicFileResult = Path.Combine(Directory.GetCurrentDirectory(), "result-dic.json");
if (!File.Exists(dicFile))
{
    Console.WriteLine($"File {dicFile} does not exist.");
    Environment.Exit(0);
}
List<DicWord> dicSourceList = File.ReadAllLines(dicFile).Select(w => new DicWord(w.ToUpper())).ToList();
Console.WriteLine($"Source dic file contains {dicSourceList.Count} words.");

// Use files
string usesDir = Path.Combine(Directory.GetCurrentDirectory(), "uses");
if (!Directory.Exists(usesDir))
    Directory.CreateDirectory(usesDir);

string[] useFiles = Directory.GetFiles(usesDir, "*.txt");
if (useFiles.Length == 0)
{
    Console.WriteLine($"No use files at '{usesDir}'");
    Environment.Exit(0);
}

Regex rgxOnlyLetters = new("[^A-Z ]");
foreach (string file in useFiles)
{
    Console.WriteLine($"Reading file {Path.GetFileName(file)}...");
    string book = File.ReadAllText(file).ToUpper();
    book = rgxOnlyLetters.Replace(book, "");
    List<WordUse> wordsList = book
        .Split(' ')
        .Where(w => w.Length == 5)
        .GroupBy(w => w)
        .Select(w => new WordUse(w.First(), w.Count()))
        .ToList();

    wordsList
        .Where(usedWord => dicSourceList.Any(dicWord => dicWord.Word == usedWord.Word))
        .ToList()
        .ForEach(usedWord =>
        {
            dicSourceList.Where(w => w.Word == usedWord.Word).First().Uses += usedWord.Occurrences;
        });
}


Console.WriteLine("Exporting json...");
string json = JsonHelper.Serialize(dicSourceList.OrderByDescending(w => w.Uses).ToList());
File.WriteAllText(dicFileResult, json);

Console.WriteLine($"File {Path.GetFileName(dicFileResult)} exported.");
Environment.Exit(0);

[DataContract]
public class DicWord
{
    [DataMember(Name = "w", Order = 1)]
    public string Word { get; set; } = "";
    [DataMember(Name = "u", Order = 2)]
    public int Uses { get; set; } = 0;
    public DicWord(string word)
    {
        Word = word;
    }
}

public class WordUse
{
    public string Word { get; set; } = "";
    public int Occurrences { get; set; } = 0;
    public WordUse(string word, int occurrences)
    {
        Word = word;
        Occurrences = occurrences;
    }
}

public static class JsonHelper
{
    public static string Serialize<T>(T item)
    {
        using MemoryStream ms = new();
        new DataContractJsonSerializer(typeof(T)).WriteObject(ms, item);
        return Encoding.Default.GetString(ms.ToArray());
    }
}